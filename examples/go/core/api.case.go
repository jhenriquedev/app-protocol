package core

import "app-protocol/examples/go/core/shared"

type ApiContext struct {
	shared.AppBaseContext
	HTTPClient shared.AppHttpClient
	DB         any
	Auth       any
	Storage    shared.AppStorageClient
	Cache      shared.AppCache
	Cases      shared.Dict
	Packages   shared.Dict
	Extra      shared.Dict
}

type ApiResponse[T any] struct {
	shared.AppResult[T]
	StatusCode int `json:"statusCode,omitempty"`
}

func (r ApiResponse[T]) HTTPStatus() int {
	return r.StatusCode
}

type RouteRequest struct {
	Body       any
	Method     string
	Path       string
	Params     map[string]string
	RawRequest any
}

type RouteBinding struct {
	Method  string
	Path    string
	Handler func(request RouteRequest) (any, error)
}

type APIHandler interface {
	HandleAny(input any) (any, error)
}

func ExecuteAPI[TInput, TOutput any](
	input TInput,
	validate func(TInput) error,
	authorize func(TInput) error,
	composition func(TInput) (TOutput, error),
	service func(TInput) (TOutput, error),
) ApiResponse[TOutput] {
	if validate != nil {
		if err := validate(input); err != nil {
			appErr := shared.ToAppError(err, "INTERNAL")
			return ApiResponse[TOutput]{
				AppResult: shared.AppResult[TOutput]{
					Success: false,
					Error:   &appErr,
				},
			}
		}
	}

	if authorize != nil {
		if err := authorize(input); err != nil {
			appErr := shared.ToAppError(err, "INTERNAL")
			return ApiResponse[TOutput]{
				AppResult: shared.AppResult[TOutput]{
					Success: false,
					Error:   &appErr,
				},
			}
		}
	}

	var (
		result TOutput
		err    error
	)

	switch {
	case composition != nil:
		result, err = composition(input)
	case service != nil:
		result, err = service(input)
	default:
		err = &shared.AppCaseError{
			Code:    "INTERNAL",
			Message: "BaseApiCase: at least one of _service or _composition must be implemented",
		}
	}

	if err != nil {
		appErr := shared.ToAppError(err, "INTERNAL")
		return ApiResponse[TOutput]{
			AppResult: shared.AppResult[TOutput]{
				Success: false,
				Error:   &appErr,
			},
		}
	}

	return ApiResponse[TOutput]{
		AppResult: shared.AppResult[TOutput]{
			Success: true,
			Data:    &result,
		},
	}
}
