package shared

import "errors"

type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details any    `json:"details,omitempty"`
}

type AppCaseError struct {
	Code    string
	Message string
	Details any
}

func (e *AppCaseError) Error() string {
	return e.Message
}

func (e *AppCaseError) ToAppError() AppError {
	return AppError{
		Code:    e.Code,
		Message: e.Message,
		Details: e.Details,
	}
}

func ToAppCaseError(err error, fallbackMessage string, fallbackCode string, fallbackDetails any) *AppCaseError {
	if err == nil {
		return &AppCaseError{
			Code:    fallbackCode,
			Message: fallbackMessage,
			Details: fallbackDetails,
		}
	}

	var caseErr *AppCaseError
	if errors.As(err, &caseErr) {
		return caseErr
	}

	return &AppCaseError{
		Code:    fallbackCode,
		Message: fallbackMessage,
		Details: fallbackDetails,
	}
}

func ToAppError(err error, fallbackCode string) AppError {
	var caseErr *AppCaseError
	if errors.As(err, &caseErr) {
		return caseErr.ToAppError()
	}

	return AppError{
		Code:    fallbackCode,
		Message: err.Error(),
	}
}

type AppResult[T any] struct {
	Success bool      `json:"success"`
	Data    *T        `json:"data,omitempty"`
	Error   *AppError `json:"error,omitempty"`
}

type StreamFailureEnvelope struct {
	CaseName      string `json:"caseName"`
	Surface       string `json:"surface"`
	OriginalEvent any    `json:"originalEvent"`
	LastError     struct {
		Message string `json:"message"`
		Code    string `json:"code,omitempty"`
		Stack   string `json:"stack,omitempty"`
	} `json:"lastError"`
	Attempts       int    `json:"attempts"`
	FirstAttemptAt string `json:"firstAttemptAt"`
	LastAttemptAt  string `json:"lastAttemptAt"`
	CorrelationID  string `json:"correlationId"`
}

type AppPaginationParams struct {
	Page   int    `json:"page,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Cursor string `json:"cursor,omitempty"`
}

type AppPaginatedResult[T any] struct {
	Items      []T    `json:"items"`
	TotalItems int    `json:"totalItems,omitempty"`
	NextCursor string `json:"nextCursor,omitempty"`
	Page       int    `json:"page,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}
