package task_list

import (
	"encoding/json"
	"fmt"
	"html/template"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type ViewState struct {
	Tasks   []Task
	Loading bool
	Error   string
}

type UI struct {
	support    core.UiCaseSupport[ViewState]
	domainCase *Domain
}

type CardActionRenderer func(task Task) (template.HTML, error)

type DesignSystemPackage interface {
	TaskBoard(columns []template.HTML) template.HTML
	TaskColumn(title string, count int, children []template.HTML) template.HTML
	TaskCard(title string, description string, status string, actions template.HTML) template.HTML
	EmptyColumnState(message string) template.HTML
	Feedback(kind string, message string) template.HTML
}

func NewUI(ctx *core.UiContext) *UI {
	return &UI{
		support: core.NewUiCaseSupport(ctx, ViewState{
			Tasks:   []Task{},
			Loading: true,
		}),
		domainCase: NewDomain(),
	}
}

func (u *UI) View() (template.HTML, error) {
	designSystem, err := u.resolveDesignSystem()
	if err != nil {
		return "", err
	}

	output, err := u.Service(TaskListInput{})
	if err != nil {
		return designSystem.Feedback("error", err.Error()), nil
	}

	renderCardActions, _ := u.support.Ctx.Extra["renderCardActions"].(CardActionRenderer)
	columns := []template.HTML{
		u.renderColumn(designSystem, "todo", "To Do", output.Tasks, renderCardActions),
		u.renderColumn(designSystem, "doing", "Doing", output.Tasks, renderCardActions),
		u.renderColumn(designSystem, "done", "Done", output.Tasks, renderCardActions),
	}

	return designSystem.TaskBoard(columns), nil
}

func (u *UI) Test() error {
	view, err := u.View()
	if err != nil {
		return err
	}

	if string(view) == "" {
		return fmt.Errorf("test: view must return a visual unit")
	}

	result, err := u.Service(TaskListInput{})
	if err != nil {
		return err
	}

	if len(result.Tasks) != 2 {
		return fmt.Errorf("test: ui service must return the mocked task list")
	}

	return nil
}

func (u *UI) Service(input TaskListInput) (TaskListOutput, error) {
	if err := u.domainCase.Validate(input); err != nil {
		return TaskListOutput{}, err
	}

	return u.repository(input)
}

func (u *UI) repository(_ TaskListInput) (TaskListOutput, error) {
	client := u.resolveAPIClient()
	if client == nil {
		return TaskListOutput{}, fmt.Errorf("task_list.ui requires ctx.api")
	}

	response, err := client.Request(map[string]any{
		"method": "GET",
		"url":    "/tasks",
	})
	if err != nil {
		return TaskListOutput{}, err
	}

	output, err := decodeTaskListOutput(response)
	if err != nil {
		return TaskListOutput{}, err
	}

	if err := u.domainCase.ValidateOutput(output); err != nil {
		return TaskListOutput{}, err
	}

	return output, nil
}

func (u *UI) resolveAPIClient() shared.AppHttpClient {
	if u.support.Ctx == nil {
		return nil
	}

	return u.support.Ctx.API
}

func (u *UI) renderColumn(designSystem DesignSystemPackage, status string, title string, tasks []Task, renderCardActions CardActionRenderer) template.HTML {
	filtered := []Task{}
	for _, task := range tasks {
		if string(task.Status) == status {
			filtered = append(filtered, task)
		}
	}

	children := []template.HTML{}
	if len(filtered) == 0 {
		children = append(children, designSystem.EmptyColumnState(fmt.Sprintf("Nenhum card em %s.", status)))
	} else {
		for _, task := range filtered {
			var actions template.HTML
			if renderCardActions != nil {
				rendered, err := renderCardActions(task)
				if err == nil {
					actions = rendered
				}
			}

			children = append(children, designSystem.TaskCard(
				task.Title,
				task.Description,
				string(task.Status),
				actions,
			))
		}
	}

	return designSystem.TaskColumn(title, len(filtered), children)
}

func (u *UI) resolveDesignSystem() (DesignSystemPackage, error) {
	if u.support.Ctx == nil || u.support.Ctx.Packages == nil {
		return nil, fmt.Errorf("task_list.ui requires packages.designSystem")
	}

	designSystem, ok := u.support.Ctx.Packages["designSystem"].(DesignSystemPackage)
	if !ok || designSystem == nil {
		return nil, fmt.Errorf("task_list.ui requires packages.designSystem")
	}

	return designSystem, nil
}

func decodeTaskListOutput(value any) (TaskListOutput, error) {
	var output TaskListOutput
	encoded, err := json.Marshal(value)
	if err != nil {
		return output, err
	}

	if err := json.Unmarshal(encoded, &output); err != nil {
		return output, err
	}

	return output, nil
}
