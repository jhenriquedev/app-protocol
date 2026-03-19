package packages.data;

import com.fasterxml.jackson.core.type.TypeReference;
import java.nio.file.Path;

public class DataPackage {
  public static class DefaultFiles {
    public Path tasks;
  }

  public final DefaultFiles defaultFiles = new DefaultFiles();

  public DataPackage(Path baseDirectory) {
    defaultFiles.tasks = baseDirectory.resolve("tasks.json");
  }

  public <T> JsonFileStore<T> createJsonFileStore(
      Path filePath,
      TypeReference<T> typeReference,
      T fallbackData
  ) {
    return new JsonFileStore<>(filePath, typeReference, fallbackData);
  }

  public static DataPackage createDataPackage(Path baseDirectory) {
    return new DataPackage(baseDirectory);
  }
}
