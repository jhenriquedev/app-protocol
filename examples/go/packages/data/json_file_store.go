package data

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type JSONFileStore[T any] struct {
	filePath     string
	fallbackData T
	mu           sync.Mutex
}

func NewJSONFileStore[T any](filePath string, fallbackData T) *JSONFileStore[T] {
	return &JSONFileStore[T]{
		filePath:     filePath,
		fallbackData: fallbackData,
	}
}

func (s *JSONFileStore[T]) FilePath() string {
	return s.filePath
}

func (s *JSONFileStore[T]) Read() (T, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var value T
	err := s.withFileLock(func() error {
		if err := s.ensureFileExists(); err != nil {
			return err
		}

		readValue, err := s.readJSONFile()
		if err != nil {
			return err
		}

		value = readValue
		return nil
	})

	return value, err
}

func (s *JSONFileStore[T]) Write(value T) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.withFileLock(func() error {
		if err := s.ensureFileExists(); err != nil {
			return err
		}

		return s.writeJSONAtomically(value)
	})
}

func (s *JSONFileStore[T]) Reset() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	return s.withFileLock(func() error {
		if err := s.ensureFileExists(); err != nil {
			return err
		}

		return s.writeJSONAtomically(s.fallbackData)
	})
}

func (s *JSONFileStore[T]) Update(updater func(current T) (T, error)) (T, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var next T
	err := s.withFileLock(func() error {
		if err := s.ensureFileExists(); err != nil {
			return err
		}

		current, err := s.readJSONFile()
		if err != nil {
			return err
		}

		updated, err := updater(current)
		if err != nil {
			return err
		}

		next = updated
		return s.writeJSONAtomically(updated)
	})

	return next, err
}

func (s *JSONFileStore[T]) ensureFileExists() error {
	if err := os.MkdirAll(filepath.Dir(s.filePath), 0o755); err != nil {
		return err
	}

	_, err := os.Stat(s.filePath)
	if err == nil {
		return nil
	}

	if !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return s.writeJSONAtomically(s.fallbackData)
}

func (s *JSONFileStore[T]) readJSONFile() (T, error) {
	var value T

	content, err := os.ReadFile(s.filePath)
	if err != nil {
		return value, err
	}

	if err := json.Unmarshal(content, &value); err != nil {
		return value, err
	}

	return value, nil
}

func (s *JSONFileStore[T]) writeJSONAtomically(value T) error {
	content, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}

	if err := os.MkdirAll(filepath.Dir(s.filePath), 0o755); err != nil {
		return err
	}

	tempFilePath := fmt.Sprintf(
		"%s.%d.%d.tmp",
		s.filePath,
		os.Getpid(),
		time.Now().UnixNano(),
	)

	if err := os.WriteFile(tempFilePath, append(content, '\n'), 0o644); err != nil {
		return err
	}

	if err := os.Rename(tempFilePath, s.filePath); err != nil {
		_ = os.Remove(tempFilePath)
		return err
	}

	return nil
}

func (s *JSONFileStore[T]) withFileLock(operation func() error) error {
	lockPath := s.filePath + ".lock"
	timeout := 5 * time.Second
	retryDelay := 25 * time.Millisecond
	staleLockAge := 30 * time.Second
	startedAt := time.Now()

	for {
		if err := os.MkdirAll(filepath.Dir(lockPath), 0o755); err != nil {
			return err
		}

		lockFile, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o644)
		if err != nil {
			if !errors.Is(err, os.ErrExist) {
				return err
			}

			if cleanupErr := cleanupStaleLock(lockPath, staleLockAge); cleanupErr != nil {
				return cleanupErr
			}

			if time.Since(startedAt) >= timeout {
				return fmt.Errorf("timed out acquiring JSONFileStore lock for %s", s.filePath)
			}

			time.Sleep(retryDelay)
			continue
		}

		_, writeErr := lockFile.WriteString(
			fmt.Sprintf("{\"pid\":%d,\"acquiredAt\":%q}\n", os.Getpid(), time.Now().UTC().Format(time.RFC3339Nano)),
		)
		closeErr := lockFile.Close()
		if writeErr != nil {
			_ = os.Remove(lockPath)
			return writeErr
		}
		if closeErr != nil {
			_ = os.Remove(lockPath)
			return closeErr
		}

		defer func() {
			_ = os.Remove(lockPath)
		}()

		return operation()
	}
}

func cleanupStaleLock(lockPath string, maxAge time.Duration) error {
	info, err := os.Stat(lockPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}

	if time.Since(info.ModTime()) <= maxAge {
		return nil
	}

	if err := os.Remove(lockPath); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}

	return nil
}
