package data

import "path/filepath"

type DefaultFiles struct {
	Tasks string
}

type Package struct {
	DefaultFiles DefaultFiles
}

func New(baseDirectory string) Package {
	return Package{
		DefaultFiles: DefaultFiles{
			Tasks: filepath.Join(baseDirectory, "tasks.json"),
		},
	}
}
