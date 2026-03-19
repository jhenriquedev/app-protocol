package agent

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"app-protocol/examples/go/core/shared"
)

func readRequestBody(req *http.Request) (any, error) {
	raw, err := readRawRequestBody(req)
	if err != nil {
		return nil, err
	}
	if raw == "" {
		return nil, nil
	}

	var decoded any
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		return nil, err
	}

	return decoded, nil
}

func readRawRequestBody(req *http.Request) (string, error) {
	if req.Body == nil {
		return "", nil
	}

	content, err := io.ReadAll(req.Body)
	if err != nil {
		return "", err
	}

	return string(content), nil
}

func errorAs(err error, target **shared.AppCaseError) bool {
	return errors.As(err, target)
}

func mapKeys[T any](values map[string]T) []string {
	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	return keys
}
