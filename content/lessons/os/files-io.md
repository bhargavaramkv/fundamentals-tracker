---
title: "Files, buffering and I/O latency"
summary: "What happens between File.Write and the bytes reaching the disk, and why that gap matters."
---

## The idea

Your code writes a line to a file and the call returns. Is the data safe on the disk? Usually not yet.

Think of posting a letter. You drop it into a postbox (a buffer). It is not delivered until the postman collects it. If the postbox burns down first, the letter is lost. Between your code and the disk there are several postboxes, and each trades safety for speed.

This lesson explains those layers, the handle your program uses to talk to a file, and why disk is so much slower than memory.

## See it work

```csharp
using var fs = new FileStream("orders.log", FileMode.Append);
byte[] line = Encoding.UTF8.GetBytes("order 42 paid\n");

fs.Write(line);        // lands in a buffer, returns fast
fs.Flush();            // pushes the buffer to the OS
fs.Flush(true);        // asks the OS to force it onto the disk
```

Three calls, three different promises. After `Write`, the bytes may exist only in your process's memory. After `Flush()`, they are handed to the operating system, but the OS may still hold them in memory. Only `Flush(true)` waits until the OS reports that the storage device has accepted the data.

```check
{"prompt": "Your program calls fs.Write(bytes) and then the machine loses power a moment later. What is the best description of the file's content?", "options": ["The new bytes may be missing", "The new bytes are certainly on the disk", "The file is always corrupted entirely", "Only the bytes after the first line survive"], "answer": 0, "explanation": "Write only guarantees the data left your call. It may sit in the FileStream buffer or the OS cache. Without a flush to disk, a power cut can lose it. The file is normally left as it was before, not wrecked."}
```

## How it works

**File descriptors.** When you open a file, the OS returns a small number, called a **file descriptor** on Linux and macOS (a **handle** on Windows). It is your process's ticket for that open file. Every read and write passes the ticket back, and the OS looks up the real file. The same idea covers sockets, pipes and the console. On Unix, descriptors 0, 1 and 2 are standard input, output and error. Each process has a limit on how many it may hold at once, so forgetting to close files eventually fails with "too many open files". In C#, `using` closes them for you.

**The layers.** A write passes through several buffers:

```steps
{"title": "Where your bytes are, step by step", "frames": [
{"visual": "App buffer   : [order 42 paid]\nOS page cache: [ ]\nDisk         : [ ]", "caption": "`fs.Write` copies the bytes into a buffer inside your process. (FileStream's default buffer is 4 KB.) Fast, but lost if the process dies."},
{"visual": "App buffer   : [ ]\nOS page cache: [order 42 paid]\nDisk         : [ ]", "caption": "`Flush()` hands them to the OS. They sit in the **page cache**, a region of RAM. The program may crash now and the data still survives, but not a power cut."},
{"visual": "App buffer   : [ ]\nOS page cache: [order 42 paid]\nDisk         : [writing...]", "caption": "`Flush(true)`, the .NET form of **fsync**, tells the OS to push the cache to the device and wait."},
{"visual": "App buffer   : [ ]\nOS page cache: [order 42 paid]\nDisk         : [order 42 paid]", "caption": "The device confirms. Now the data survives a power loss. This wait is the slow part."}
]}
```

Buffers exist because each trip to the disk is expensive. Writing 1,000 lines in one go is far cheaper than 1,000 separate trips.

**Why disk is slow.** Rough, order-of-magnitude figures:

| Operation | Typical time |
|---|---|
| Read from RAM | ~100 nanoseconds |
| Read from an SSD | ~100 microseconds (about 1,000x RAM) |
| Read from a spinning hard disk | ~10 milliseconds (about 100,000x RAM) |
| A round trip to another data centre | tens of milliseconds |

A hard disk must physically move its head, so reading data in order (**sequential** access) is much faster than jumping around (**random** access). SSDs have no moving parts but still prefer large, sequential operations. That is why databases write a sequential **log** first and organise data later.

**Saving safely.** If you overwrite a config file in place and the program dies halfway, the file is half old, half new. The safe recipe: write a temporary file, flush it to disk, then **rename** it over the original. A rename is atomic on the same volume, so readers see either the old file or the new one, never a mix. In .NET, `File.Replace` or `File.Move(tmp, path, overwrite: true)` does the final step.

```check
{"prompt": "You must write 100,000 small log lines to a file. Which approach is generally the fastest while staying reasonably safe?", "options": ["Buffered writes, flushing to disk every so often", "A Flush(true) call after every single line", "Opening and closing the file for every line", "Writing each line from a different thread"], "answer": 0, "explanation": "Forcing every line to disk pays the slow device wait 100,000 times. Batching amortises that cost, and you accept losing the last few lines on a crash. Reopening the file each line is even slower, and extra threads would just queue on one disk."}
```

## Where you'll meet it

- **Databases and message brokers** call fsync before they say "committed". Their durability settings trade speed against safety.
- **Logging**: async buffered logging is fast; the last second of logs can vanish in a crash.
- **"Too many open files"** errors on servers that leak sockets or file handles.
- **Caching**: a RAM cache beats a disk read by orders of magnitude, which is the whole reason caches exist.
- **Interviews:** "What does fsync do?" and "Why is sequential I/O faster?"

```reveal
{"prompt": "A service updates `settings.json` by opening it, truncating it and writing the new text. The process is killed halfway. What state is the file in, and what would you change?", "answer": "It can be **empty or half-written**, so the next start-up fails to parse it. Instead, write `settings.json.tmp`, flush it to disk, then rename it over `settings.json`. The rename is atomic, so the file is always either the complete old version or the complete new one."}
```

## Common mistakes

- **Assuming a returned Write means durable.** Only a flush to disk gives that, and even then only if the hardware tells the truth.
- **fsync on every tiny write** when you do not need that guarantee. It can make a program 100 times slower.
- **Not closing files.** Leaked descriptors, locked files and unflushed buffers. Use `using`.
- **Reading a big file byte by byte** with no buffering, or loading a multi-gigabyte file into memory at once. Stream it in chunks.
- **Ignoring the disk in design.** A loop doing one file read per item may be fast with 10 items and slow with 100,000.

## Recap

- A **file descriptor** (handle) is the process's ticket to an open file, socket or pipe. Close them.
- Data passes through an **app buffer**, then the **OS page cache**, then the device. Only **fsync** (`Flush(true)`) forces it all the way down.
- Memory is roughly 1,000x faster than an SSD and 100,000x faster than a spinning disk, and sequential beats random access.
- Batch writes for speed; flush at the points where you need safety.
- Replace files by write-temp, flush, rename.
