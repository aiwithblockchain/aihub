package task

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ResultMetadata struct {
	ContentType string `json:"contentType"`
	Filename    string `json:"filename"`
	Size        int64  `json:"size"`
}

type ResultStore struct {
	baseDir string
}

func NewResultStore(baseDir string) *ResultStore {
	return &ResultStore{
		baseDir: baseDir,
	}
}

func (s *ResultStore) getTaskDir(taskID string) string {
	return filepath.Join(s.baseDir, taskID, "result")
}

func (s *ResultStore) WriteResult(taskID string, contentType string, data []byte) (string, error) {
	dir := s.getTaskDir(taskID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create result directory: %w", err)
	}
	
	// Create proper extension depending on content type
	filename := "result.bin"
	if contentType == "application/json" {
		filename = "result.json"
	}
	path := filepath.Join(dir, filename)
	
	if err := os.WriteFile(path, data, 0644); err != nil {
		return "", fmt.Errorf("failed to save result payload: %w", err)
	}

	// Persistent Metadata to honor ContentType regardless of simple file extension logic above
	meta := ResultMetadata{
		ContentType: contentType,
		Filename:    filename,
		Size:        int64(len(data)),
	}
	metaData, _ := json.MarshalIndent(meta, "", "  ")
	os.WriteFile(filepath.Join(dir, "metadata.json"), metaData, 0644)

	ref := fmt.Sprintf("task-result://%s/%s", taskID, filename)
	return ref, nil
}

func (s *ResultStore) ReadResult(taskID string, resultRef string) ([]byte, string, error) {
	// Simple parsing since we control ref generation
	prefix := "task-result://"
	if !strings.HasPrefix(resultRef, prefix) {
		return nil, "", fmt.Errorf("invalid result reference prefix: %s", resultRef)
	}
	parts := strings.Split(strings.TrimPrefix(resultRef, prefix), "/")
	if len(parts) != 2 {
		return nil, "", fmt.Errorf("invalid result reference format: %s", resultRef)
	}
	
	refTaskID, filename := parts[0], parts[1]
	if refTaskID != taskID {
		return nil, "", fmt.Errorf("resultRef mismatch: task %s vs associated ref %s", taskID, refTaskID)
	}
	
	path := filepath.Join(s.getTaskDir(taskID), filename)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, "", fmt.Errorf("result reference %s is missing from disk", resultRef)
		}
		return nil, "", err
	}
	
	// Recover pristine original content-type
	contentType := "application/octet-stream"
	metaPath := filepath.Join(s.getTaskDir(taskID), "metadata.json")
	if metaData, metaErr := os.ReadFile(metaPath); metaErr == nil {
		var meta ResultMetadata
		if json.Unmarshal(metaData, &meta) == nil && meta.ContentType != "" {
			contentType = meta.ContentType
		}
	} else if filepath.Ext(filename) == ".json" {
		contentType = "application/json"
	}
	
	return data, contentType, nil
}

func (s *ResultStore) CleanupTaskResult(taskID string) error {
	return os.RemoveAll(s.getTaskDir(taskID))
}
