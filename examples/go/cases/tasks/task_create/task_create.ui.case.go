package task_create

import (
	"encoding/json"
	"fmt"
	"html/template"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type ViewState struct {
	Title       string
	Description string
	Loading     bool
	Error       string
	Result      *TaskCreateOutput
}

type UI struct {
	support    core.UiCaseSupport[ViewState]
	domainCase *Domain
}

type DesignSystemPackage interface {
	CreateTaskForm(action string, titleValue string, descriptionValue string, errorMessage string) template.HTML
}

func NewUI(ctx *core.UiContext) *UI {
	return &UI{
		support:    core.NewUiCaseSupport(ctx, ViewState{}),
		domainCase: NewDomain(),
	}
}

func (u *UI) View() (template.HTML, error) {
	actionPath := "/tasks/create"
	if u.support.Ctx != nil && u.support.Ctx.Extra != nil {
		if value, ok := u.support.Ctx.Extra["actionPath"].(string); ok && value != "" {
			actionPath = value
		}
	}

	designSystem, err := u.resolveDesignSystem()
	if err != nil {
		return "", err
	}

	return designSystem.CreateTaskForm(
		actionPath,
		u.support.State.Title,
		u.support.State.Description,
		u.support.State.Error,
	), nil
}

func (u *UI) Test() error {
	view, err := u.View()
	if err != nil {
		return err
	}

	if string(view) == "" {
		return fmt.Errorf("test: view must return a visual unit")
	}

	result, err := u.Service(TaskCreateInput{
		Title:       "Create task UI test",
		Description: "UI surface repository flow",
	})
	if err != nil {
		return err
	}

	if result.Task.ID == "" {
		return fmt.Errorf("test: ui service must return a created task id")
	}

	if _, err := u.Service(TaskCreateInput{Title: "   "}); err == nil {
		return fmt.Errorf("test: ui service must reject blank title")
	}

	return nil
}

func (u *UI) Service(input TaskCreateInput) (TaskCreateOutput, error) {
	if err := u.domainCase.Validate(input); err != nil {
		return TaskCreateOutput{}, err
	}

	return u.repository(input)
}

func (u *UI) repository(input TaskCreateInput) (TaskCreateOutput, error) {
	client := u.resolveAPIClient()
	if client == nil {
		return TaskCreateOutput{}, fmt.Errorf("task_create.ui requires ctx.api")
	}

	response, err := client.Request(map[string]any{
		"method": "POST",
		"url":    "/tasks",
		"body":   input,
	})
	if err != nil {
		return TaskCreateOutput{}, err
	}

	output, err := decodeTaskCreateOutput(response)
	if err != nil {
		return TaskCreateOutput{}, err
	}

	if err := u.domainCase.ValidateOutput(output); err != nil {
		return TaskCreateOutput{}, err
	}

	return output, nil
}

func (u *UI) resolveAPIClient() shared.AppHttpClient {
	if u.support.Ctx == nil {
		return nil
	}

	return u.support.Ctx.API
}

func (u *UI) resolveDesignSystem() (DesignSystemPackage, error) {
	if u.support.Ctx == nil || u.support.Ctx.Packages == nil {
		return nil, fmt.Errorf("task_create.ui requires packages.designSystem")
	}

	designSystem, ok := u.support.Ctx.Packages["designSystem"].(DesignSystemPackage)
	if !ok || designSystem == nil {
		return nil, fmt.Errorf("task_create.ui requires packages.designSystem")
	}

	return designSystem, nil
}

func decodeTaskCreateOutput(value any) (TaskCreateOutput, error) {
	var output TaskCreateOutput
	encoded, err := json.Marshal(value)
	if err != nil {
		return output, err
	}

	if err := json.Unmarshal(encoded, &output); err != nil {
		return output, err
	}

	return output, nil
}
