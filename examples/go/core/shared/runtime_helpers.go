package shared

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"
)

func NewID() string {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}

	return hex.EncodeToString(buffer)
}
