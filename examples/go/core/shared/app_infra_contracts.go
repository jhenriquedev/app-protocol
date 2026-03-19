package shared

type AppHttpClient interface {
	Request(config any) (any, error)
}

type AppStorageClient interface {
	Get(key string) (any, error)
	Set(key string, value any) error
}

type AppCache interface {
	Get(key string) (any, error)
	Set(key string, value any, ttlSeconds int) error
}

type AppEventPublisher interface {
	Publish(event string, payload any) error
}
