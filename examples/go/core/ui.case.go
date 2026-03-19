package core

import "app-protocol/examples/go/core/shared"

type UiContext struct {
	shared.AppBaseContext
	Renderer any
	Router   any
	Store    any
	API      shared.AppHttpClient
	Packages shared.Dict
	Extra    shared.Dict
}

type UiCaseSupport[TState any] struct {
	Ctx   *UiContext
	State TState
}

func NewUiCaseSupport[TState any](ctx *UiContext, initialState TState) UiCaseSupport[TState] {
	return UiCaseSupport[TState]{
		Ctx:   ctx,
		State: initialState,
	}
}

func (u *UiCaseSupport[TState]) SetState(next TState) {
	u.State = next
}

func (u *UiCaseSupport[TState]) Test() error {
	return nil
}
