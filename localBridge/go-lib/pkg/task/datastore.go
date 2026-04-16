package task

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

type InputMetadata struct {
	TotalParts    int    `json:"totalParts"`
	ReceivedParts int    `json:"receivedParts"`
	Sealed        bool   `json:"sealed"`
	TotalBytes    int64  `json:"totalBytes"`
	ContentType   string `json:"contentType"`
}

type DataStore struct {
	baseDir string
	mu      sync.RWMutex
}

func NewDataStore(baseDir string) *DataStore {
	return &DataStore{
		baseDir: baseDir,
	}
}

func (s *DataStore) getTaskDir(taskID string) string {
	return filepath.Join(s.baseDir, taskID, "input")
}

func (s *DataStore) getMetaPath(taskID string) string {
	return filepath.Join(s.getTaskDir(taskID), "metadata.json")
}

func (s *DataStore) getPartPath(taskID string, partIndex int) string {
	return filepath.Join(s.getTaskDir(taskID), fmt.Sprintf("part_%06d", partIndex))
}

func (s *DataStore) ensureTaskDir(taskID string) error {
	dir := s.getTaskDir(taskID)
	return os.MkdirAll(dir, 0755)
}

func (s *DataStore) countPartsNoLock(taskID string) int {
	dir := s.getTaskDir(taskID)
	entries, err := os.ReadDir(dir)
	if err != nil {
		return 0
	}
	count := 0
	for _, e := range entries {
		if !e.IsDir() && len(e.Name()) >= 5 && e.Name()[:5] == "part_" {
			count++
		}
	}
	return count
}

func (s *DataStore) getInputMetadataNoLock(taskID string) (*InputMetadata, error) {
	data, err := os.ReadFile(s.getMetaPath(taskID))
	if err != nil {
		if os.IsNotExist(err) {
			return &InputMetadata{
				ReceivedParts: s.countPartsNoLock(taskID), // Scan dynamic counts
			}, nil // Default empty state without error if it never properly sealed yet
		}
		return nil, err
	}
	var meta InputMetadata
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	// Always scan exact disk part count for ReceivedParts
	meta.ReceivedParts = s.countPartsNoLock(taskID)
	return &meta, nil
}

func (s *DataStore) GetInputMetadata(taskID string) (*InputMetadata, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.getInputMetadataNoLock(taskID)
}

func (s *DataStore) writeInputMetadataNoLock(taskID string, meta *InputMetadata) error {
	data, err := json.MarshalIndent(meta, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.getMetaPath(taskID), data, 0644)
}

func (s *DataStore) WriteInputPart(taskID string, partIndex int, data []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if err := s.ensureTaskDir(taskID); err != nil {
		return err
	}

	meta, err := s.getInputMetadataNoLock(taskID)
	if err != nil {
		return err
	}
	if meta.Sealed {
		return fmt.Errorf("task %s input is already sealed and cannot receive new parts", taskID)
	}

	// Just write unconditionally; our internal count is dynamically resolved by the filesystem contents naturally making it idempotent
	partPath := s.getPartPath(taskID, partIndex)
	if err := os.WriteFile(partPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write part %d to storage: %w", partIndex, err)
	}

	return nil
}

func (s *DataStore) SealInput(taskID string, totalParts int, totalBytes int64, contentType string) (*InputMetadata, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	meta, err := s.getInputMetadataNoLock(taskID)
	if err != nil {
		return nil, err
	}
	if meta.Sealed {
		return meta, nil
	}

	meta.TotalParts = totalParts
	meta.TotalBytes = totalBytes
	meta.ContentType = contentType
	meta.Sealed = true

	if err := s.writeInputMetadataNoLock(taskID, meta); err != nil {
		return nil, err
	}

	return meta, nil
}

func (s *DataStore) ReadInputPart(taskID string, partIndex int) ([]byte, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	meta, err := s.getInputMetadataNoLock(taskID)
	if err != nil {
		return nil, err
	}
	if !meta.Sealed {
		return nil, fmt.Errorf("task %s input is not sealed (cannot read parts until sealed)", taskID)
	}

	if partIndex < 0 || partIndex >= meta.TotalParts {
		return nil, fmt.Errorf("task %s partIndex %d is out of bounds (total parts expected %d)", taskID, partIndex, meta.TotalParts)
	}

	partPath := s.getPartPath(taskID, partIndex)
	data, err := os.ReadFile(partPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, fmt.Errorf("task %s part %d is catastrophically missing from disk", taskID, partIndex)
		}
		return nil, fmt.Errorf("failed to read task %s part %d from storage: %w", taskID, partIndex, err)
	}
	return data, nil
}

func (s *DataStore) CleanupTaskInput(taskID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return os.RemoveAll(s.getTaskDir(taskID))
}
