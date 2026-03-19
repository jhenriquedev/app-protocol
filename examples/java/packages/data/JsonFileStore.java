package packages.data;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.util.Objects;
import java.util.UUID;

public class JsonFileStore<T> {
  private static final ObjectMapper MAPPER = new ObjectMapper();

  @FunctionalInterface
  public interface CheckedUpdater<T> {
    T apply(T current) throws Exception;
  }

  private final Path filePath;
  private final Path lockFilePath;
  private final TypeReference<T> typeReference;
  private final T fallbackData;

  public JsonFileStore(Path filePath, TypeReference<T> typeReference, T fallbackData) {
    this.filePath = filePath;
    this.lockFilePath = filePath.resolveSibling(filePath.getFileName() + ".lock");
    this.typeReference = typeReference;
    this.fallbackData = fallbackData;
  }

  public Path filePath() {
    return filePath;
  }

  public synchronized T read() throws Exception {
    return withFileLock(() -> {
      ensureFileExists();
      return readJsonFile();
    });
  }

  public synchronized void write(T value) throws Exception {
    withFileLock(() -> {
      ensureFileExists();
      writeJsonAtomically(value);
      return null;
    });
  }

  public synchronized void reset() throws Exception {
    withFileLock(() -> {
      ensureFileExists();
      writeJsonAtomically(fallbackData);
      return null;
    });
  }

  public synchronized T update(CheckedUpdater<T> updater) throws Exception {
    return withFileLock(() -> {
      ensureFileExists();
      T current = readJsonFile();
      T next = updater.apply(current);
      if (!Objects.equals(next, current)) {
        writeJsonAtomically(next);
      }
      return next;
    });
  }

  private interface CheckedSupplier<T> {
    T get() throws Exception;
  }

  private <R> R withFileLock(CheckedSupplier<R> supplier) throws Exception {
    Files.createDirectories(lockFilePath.getParent());

    try (FileChannel channel = FileChannel.open(
        lockFilePath,
        StandardOpenOption.CREATE,
        StandardOpenOption.WRITE
    );
         FileLock ignored = channel.lock()) {
      return supplier.get();
    }
  }

  private void ensureFileExists() throws IOException {
    Files.createDirectories(filePath.getParent());
    if (!Files.exists(filePath)) {
      writeJsonAtomically(fallbackData);
    }
  }

  private T readJsonFile() throws IOException {
    return MAPPER.readValue(Files.readString(filePath), typeReference);
  }

  private void writeJsonAtomically(T value) throws IOException {
    Path tempFile = filePath.resolveSibling(
        filePath.getFileName() + "." + ProcessHandle.current().pid() + "." + UUID.randomUUID() + ".tmp"
    );

    Files.createDirectories(filePath.getParent());
    Files.writeString(tempFile, MAPPER.writerWithDefaultPrettyPrinter().writeValueAsString(value) + "\n");

    try {
      Files.move(
          tempFile,
          filePath,
          StandardCopyOption.REPLACE_EXISTING,
          StandardCopyOption.ATOMIC_MOVE
      );
    } catch (AtomicMoveNotSupportedException ignored) {
      Files.move(tempFile, filePath, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      Files.deleteIfExists(tempFile);
    }
  }
}
