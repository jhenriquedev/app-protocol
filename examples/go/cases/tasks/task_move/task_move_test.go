package task_move

import (
	"html/template"
	"testing"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type testStore struct {
	records []map[string]any
}

func (s *testStore) Read() ([]map[string]any, error) {
	return append([]map[string]any(nil), s.records...), nil
}

func (s *testStore) Write(value []map[string]any) error {
	s.records = append([]map[string]any(nil), value...)
	return nil
}

func (s *testStore) Reset() error {
	s.records = []map[string]any{}
	return nil
}

func (s *testStore) Update(updater func(current []map[string]any) ([]map[string]any, error)) ([]map[string]any, error) {
	next, err := updater(append([]map[string]any(nil), s.records...))
	if err != nil {
		return nil, err
	}
	s.records = append([]map[string]any(nil), next...)
	return next, nil
}

type testHTTPClient struct{}

func (testHTTPClient) Request(config any) (any, error) {
	record := config.(map[string]any)
	body := record["body"].(map[string]any)
	return TaskMoveOutput{
		Task: Task{
			ID:        "task_001",
			Title:     "Moved task",
			Status:    TaskStatus(body["targetStatus"].(TaskStatus)),
			CreatedAt: "2026-03-18T12:00:00.000Z",
			UpdatedAt: "2026-03-18T12:10:00.000Z",
		},
	}, nil
}

type testDesignSystem struct{}

func (testDesignSystem) MoveTaskAction(action string, currentStatus string) template.HTML {
	return template.HTML("<form></form>")
}

func TestDomain(t *testing.T) {
	if err := NewDomain().Test(); err != nil {
		t.Fatal(err)
	}
}

func TestAPI(t *testing.T) {
	store := &testStore{}
	api := NewAPI(&core.ApiContext{
		AppBaseContext: shared.AppBaseContext{Logger: shared.DefaultLogger{Prefix: "[test]"}},
		Extra: shared.Dict{
			"providers": shared.Dict{
				"taskStore": store,
			},
		},
	})
	if err := api.Test(); err != nil {
		t.Fatal(err)
	}
}

func TestUI(t *testing.T) {
	ui := NewUI(&core.UiContext{
		API: testHTTPClient{},
		Packages: shared.Dict{
			"designSystem": testDesignSystem{},
		},
		Extra: shared.Dict{
			"task": Task{
				ID:        "task_001",
				Title:     "Moved task",
				Status:    TaskStatusTodo,
				CreatedAt: "2026-03-18T12:00:00.000Z",
				UpdatedAt: "2026-03-18T12:00:00.000Z",
			},
		},
	})
	if err := ui.Test(); err != nil {
		t.Fatal(err)
	}
}

func TestAgentic(t *testing.T) {
	if err := NewAgentic(&core.AgenticContext{}).Test(); err != nil {
		t.Fatal(err)
	}
}
