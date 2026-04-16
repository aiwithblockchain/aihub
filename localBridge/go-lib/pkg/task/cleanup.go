package task

import (
	"log"
	"time"
)

type Cleaner struct {
	manager     *Manager
	dataStore   *DataStore
	resultStore *ResultStore
	stopCh      chan struct{}
}

func NewCleaner(manager *Manager, dataStore *DataStore, resultStore *ResultStore) *Cleaner {
	return &Cleaner{
		manager:     manager,
		dataStore:   dataStore,
		resultStore: resultStore,
		stopCh:      make(chan struct{}),
	}
}

func (c *Cleaner) Start() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for {
			select {
			case <-ticker.C:
				c.runCleanup()
			case <-c.stopCh:
				ticker.Stop()
				return
			}
		}
	}()
}

func (c *Cleaner) Stop() {
	close(c.stopCh)
}

func (c *Cleaner) runCleanup() {
	c.manager.mu.Lock()
	defer c.manager.mu.Unlock()

	now := time.Now()
	for id, t := range c.manager.tasks {
		switch t.State {
		case TaskCompleted:
			if t.UpdatedAt.Add(1 * time.Hour).Before(now) {
				c.dataStore.CleanupTaskInput(id)
				c.resultStore.CleanupTaskResult(id)
				delete(c.manager.tasks, id)
				log.Printf("[TaskCleaner] Cleared completed task %s", id)
			}
		case TaskFailed, TaskCancelled:
			if t.UpdatedAt.Add(24 * time.Hour).Before(now) {
				c.dataStore.CleanupTaskInput(id)
				c.resultStore.CleanupTaskResult(id)
				delete(c.manager.tasks, id)
				log.Printf("[TaskCleaner] Cleared failed/cancelled task %s", id)
			}
		case TaskCreated, TaskReceivingInput, TaskReady:
			if t.UpdatedAt.Add(1 * time.Hour).Before(now) {
				c.dataStore.CleanupTaskInput(id)
				c.resultStore.CleanupTaskResult(id)
				delete(c.manager.tasks, id)
				log.Printf("[TaskCleaner] Cleared zombie task %s", id)
			}
		}
	}
}
