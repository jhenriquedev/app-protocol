package task_move

import (
	"encoding/json"
	"fmt"
	"html/template"

	"app-protocol/examples/go/core"
	"app-protocol/examples/go/core/shared"
)

type ViewState struct {
	Loading bool
	Error   string
}

type UI struct {
	support    core.UiCaseSupport[ViewState]
	domainCase *Domain
}

type DesignSystemPackage interface {
	MoveTaskAction(action string, currentStatus string) template.HTML
}

func NewUI(ctx *core.UiContext) *UI {
	return &UI{
		support:    core.NewUiCaseSupport(ctx, ViewState{}),
		domainCase: NewDomain(),
	}
}

func (u *UI) View() (template.HTML, error) {
	task, err := u.resolveTask()
	if err != nil {
		return "", err
	}

	actionPath := "/tasks/" + task.ID + "/status"
	if value, ok := u.support.Ctx.Extra["actionPath"].(string); ok && value != "" {
		actionPath = value
	}

	designSystem, err := u.resolveDesignSystem()
	if err != nil {
		return "", err
	}

	return designSystem.MoveTaskAction(actionPath, string(task.Status)), nil
}

func (u *UI) Test() error {
	view, err := u.View()
	if err != nil {
		return err
	}

	if string(view) == "" {
		return fmt.Errorf("test: view must return a visual unit")
	}

	result, err := u.Service(TaskMoveInput{
		TaskID:       "task_001",
		TargetStatus: TaskStatusDoing,
	})
	if err != nil {
		return err
	}

	if result.Task.Status != TaskStatusDoing {
		return fmt.Errorf("test: ui service must return the moved task")
	}

	if _, err := u.Service(TaskMoveInput{
		TaskID:       "",
		TargetStatus: TaskStatusDone,
	}); err == nil {
		return fmt.Errorf("test: ui service must reject invalid input")
	}

	return nil
}

func (u *UI) Service(input TaskMoveInput) (TaskMoveOutput, error) {
	if err := u.domainCase.Validate(input); err != nil {
		return TaskMoveOutput{}, err
	}

	return u.repository(input)
}

func (u *UI) repository(input TaskMoveInput) (TaskMoveOutput, error) {
	client := u.resolveAPIClient()
	if client == nil {
		return TaskMoveOutput{}, fmt.Errorf("task_move.ui requires ctx.api")
	}

	response, err := client.Request(map[string]any{
		"method": "PATCH",
		"url":    fmt.Sprintf("/tasks/%s/status", input.TaskID),
		"body": map[string]any{
			"targetStatus": input.TargetStatus,
		},
	})
	if err != nil {
		return TaskMoveOutput{}, err
	}

	output, err := decodeTaskMoveOutput(response)
	if err != nil {
		return TaskMoveOutput{}, err
	}

	if err := u.domainCase.ValidateOutput(output); err != nil {
		return TaskMoveOutput{}, err
	}

	return output, nil
}

func (u *UI) resolveTask() (Task, error) {
	if u.support.Ctx == nil || u.support.Ctx.Extra == nil {
		return Task{}, fmt.Errorf("task_move.ui requires extra.task")
	}

	taskValue, ok := u.support.Ctx.Extra["task"]
	if !ok {
		return Task{}, fmt.Errorf("task_move.ui requires extra.task")
	}

	return decodeTask(taskValue)
}

func (u *UI) resolveAPIClient() shared.AppHttpClient {
	if u.support.Ctx == nil {
		return nil
	}

	return u.support.Ctx.API
}

func (u *UI) resolveDesignSystem() (DesignSystemPackage, error) {
	if u.support.Ctx == nil || u.support.Ctx.Packages == nil {
		return nil, fmt.Errorf("task_move.ui requires packages.designSystem")
	}

	designSystem, ok := u.support.Ctx.Packages["designSystem"].(DesignSystemPackage)
	if !ok || designSystem == nil {
		return nil, fmt.Errorf("task_move.ui requires packages.designSystem")
	}

	return designSystem, nil
}

func decodeTaskMoveOutput(value any) (TaskMoveOutput, error) {
	var output TaskMoveOutput
	encoded, err := json.Marshal(value)
	if err != nil {
		return output, err
	}

	if err := json.Unmarshal(encoded, &output); err != nil {
		return output, err
	}

	return output, nil
}
