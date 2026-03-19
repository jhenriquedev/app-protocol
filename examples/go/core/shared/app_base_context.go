package shared

import "log"

type Dict map[string]any

type AppSchema map[string]any

type AppLogger interface {
	Debug(message string, meta any)
	Info(message string, meta any)
	Warn(message string, meta any)
	Error(message string, meta any)
}

type DefaultLogger struct {
	Prefix string
}

func (l DefaultLogger) Debug(message string, meta any) {
	log.Printf("%s %s %v", l.Prefix, message, meta)
}

func (l DefaultLogger) Info(message string, meta any) {
	log.Printf("%s %s %v", l.Prefix, message, meta)
}

func (l DefaultLogger) Warn(message string, meta any) {
	log.Printf("%s %s %v", l.Prefix, message, meta)
}

func (l DefaultLogger) Error(message string, meta any) {
	log.Printf("%s %s %v", l.Prefix, message, meta)
}

type AppBaseContext struct {
	CorrelationID string
	ExecutionID   string
	TenantID      string
	UserID        string
	Logger        AppLogger
	Config        Dict
}
