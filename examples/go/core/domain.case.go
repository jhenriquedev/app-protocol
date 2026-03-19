package core

import (
	"encoding/json"

	"app-protocol/examples/go/core/shared"
)

type Dict = shared.Dict
type AppSchema = shared.AppSchema

type DomainExample struct {
	Name        string   `json:"name"`
	Description string   `json:"description,omitempty"`
	Input       any      `json:"input"`
	Output      any      `json:"output,omitempty"`
	Notes       []string `json:"notes,omitempty"`
}

type DomainDefinition struct {
	CaseName     string           `json:"caseName"`
	Description  string           `json:"description"`
	InputSchema  shared.AppSchema `json:"inputSchema"`
	OutputSchema shared.AppSchema `json:"outputSchema"`
	Invariants   []string         `json:"invariants"`
	ValueObjects shared.Dict      `json:"valueObjects"`
	Enums        shared.Dict      `json:"enums"`
	Examples     []DomainExample  `json:"examples"`
}

type ValueObject struct {
	props any
}

func NewValueObject(props any) ValueObject {
	return ValueObject{props: props}
}

func (v ValueObject) ToJSON() any {
	return v.props
}

func (v ValueObject) Equals(other ValueObject) bool {
	left, _ := json.Marshal(v.props)
	right, _ := json.Marshal(other.props)
	return string(left) == string(right)
}

type DomainCaseSupport struct{}

func (DomainCaseSupport) Invariants() []string {
	return []string{}
}

func (DomainCaseSupport) ValueObjects() shared.Dict {
	return shared.Dict{}
}

func (DomainCaseSupport) Enums() shared.Dict {
	return shared.Dict{}
}

func (DomainCaseSupport) Examples() []DomainExample {
	return []DomainExample{}
}

func (DomainCaseSupport) Test() error {
	return nil
}
