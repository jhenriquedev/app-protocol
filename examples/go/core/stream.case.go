package core

import "app-protocol/examples/go/core/shared"

type StreamContext struct {
	shared.AppBaseContext
	Publisher shared.AppEventPublisher
	Cases     shared.Dict
	Packages  shared.Dict
	Extra     shared.Dict
}

type StreamEvent struct {
	Name    string `json:"name"`
	Payload any    `json:"payload"`
}

type StreamCaseSupport struct {
	Ctx *StreamContext
}

func (s *StreamCaseSupport) Test() error {
	return nil
}
