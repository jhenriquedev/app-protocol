package task_list

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

type testHTTPClient struct{}

func (testHTTPClient) Request(config any) (any, error) {
	return TaskListOutput{
		Tasks: []Task{
			{
				ID:        "task_001",
				Title:     "First task",
				Status:    TaskStatusTodo,
				CreatedAt: "2026-03-18T12:00:00.000Z",
				UpdatedAt: "2026-03-18T12:00:00.000Z",
			},
			{
				ID:        "task_002",
				Title:     "Second task",
				Status:    TaskStatusDoing,
				CreatedAt: "2026-03-18T12:10:00.000Z",
				UpdatedAt: "2026-03-18T12:10:00.000Z",
			},
		},
	}, nil
}

type testDesignSystem struct{}

func (testDesignSystem) TaskBoard(columns []template.HTML) template.HTML {
	return template.HTML("<section></section>")
}

func (testDesignSystem) TaskColumn(title string, count int, children []template.HTML) template.HTML {
	return template.HTML("<article></article>")
}

func (testDesignSystem) TaskCard(title string, description string, status string, actions template.HTML) template.HTML {
	return template.HTML("<div></div>")
}

func (testDesignSystem) EmptyColumnState(message string) template.HTML {
	return template.HTML("<p></p>")
}

func (testDesignSystem) Feedback(kind string, message string) template.HTML {
	return template.HTML("<div></div>")
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
		Extra: shared.Dict{},
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
