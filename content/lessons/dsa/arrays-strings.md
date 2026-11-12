---
title: "Arrays & strings"
summary: "How a row of numbered boxes in memory works, and why a string is just an array of characters."
---

## The idea

Think of a row of lockers in a school hallway, numbered 0, 1, 2, 3 and so on. Each locker holds one thing. If someone says "open locker 7", you walk straight to it. You do not check lockers 0 to 6 first.

An **array** is exactly that: a fixed row of boxes, side by side in memory, each holding one value. The number of a box is its **index**, and counting starts at **0**. An array of 5 items has indexes 0 to 4.

Arrays are the simplest and most used **data structure** (a way of organizing data so some jobs become easy). Almost everything else is built on top of them.

## See it work

```csharp
int[] scores = { 90, 72, 85, 60 };
int first = scores[0];    // 90
scores[2] = 99;           // replace 85
int n = scores.Length;    // 4
```

```
index:   0    1    2    3
       +----+----+----+----+
       | 90 | 72 | 99 | 60 |
       +----+----+----+----+
```

Why is `scores[2]` instant? The boxes sit side by side, each the same size. The computer takes the address where the array starts and adds `2 × (size of one box)`. One calculation, whatever the array size. That is **O(1)** access: the cost does not grow with the array. (New to O(1)? Read *Big-O, from scratch* first.)

```check
{"prompt": "An array has 6 items. What is the index of the last one?", "options": ["6", "5", "7", "1"], "answer": 1, "explanation": "Indexes start at 0, so six items use indexes 0, 1, 2, 3, 4, 5. The last index is always length minus 1."}
```

## Inserting in the middle

An array has a fixed size and no gaps. To insert in the middle, everything after the spot must slide one place right to make room. Watch it:

```steps
{"title": "Insert 50 at index 1", "frames": [
  {"visual": "index:  0    1    2    3    4\n      | 90 | 72 | 99 | 60 |    |", "caption": "One free slot at the end. We want 50 at index 1."},
  {"visual": "index:  0    1    2    3    4\n      | 90 | 72 | 99 |    | 60 |", "caption": "Move 60 one place right."},
  {"visual": "index:  0    1    2    3    4\n      | 90 | 72 |    | 99 | 60 |", "caption": "Move 99 right."},
  {"visual": "index:  0    1    2    3    4\n      | 90 |    | 72 | 99 | 60 |", "caption": "Move 72 right. Index 1 is free now."},
  {"visual": "index:  0    1    2    3    4\n      | 90 | 50 | 72 | 99 | 60 |", "caption": "Drop 50 in. Four items moved. With n items that is up to n moves."}
]}
```

Shifting touches up to n items, so inserting or deleting in the middle is **O(n)**. Reading or writing by index stays **O(1)**. Finding a value when you don't know its position is **O(n)**, since you check each box.

```check
{"prompt": "You have an array of 1,000 items and insert a new item at the very front. Roughly how many items must move?", "options": ["None", "1", "About 1,000", "About 10"], "answer": 2, "explanation": "Every existing item has to slide one place right to free index 0. That is n moves, so inserting at the front is O(n)."}
```

```reveal
{"prompt": "Spot the bug: for (int i = 0; i <= scores.Length; i++) Console.WriteLine(scores[i]);", "answer": "On the last pass `i` equals `Length`, one past the final index, so it throws an **IndexOutOfRangeException**. Use `i < scores.Length`."}
```

## Resizable arrays and strings

If you don't know the size up front, use `List<T>`. It is an array that, when full, quietly makes a bigger one and copies everything across. Adding at the end is still cheap on average.

A **string** is an array of characters: `"hello"` is the boxes `h e l l o`, so `s[1]` is `'e'`. In C# strings are **immutable**: you cannot change a character in place. Every "change" builds a new string.

```csharp
string s = "cat";
string t = s + "s";   // a brand new string "cats"
```

```reveal
{"prompt": "What does this print? string s = \"cat\"; s.ToUpper(); Console.WriteLine(s);", "answer": "It prints **cat**. `ToUpper()` returns a *new* string and leaves `s` alone, because strings are immutable. You would need `s = s.ToUpper();`."}
```

## Two pointers

A handy technique: keep two indexes and move them toward each other. A palindrome reads the same backwards:

```csharp
bool IsPalindrome(string s) {
    int i = 0, j = s.Length - 1;
    while (i < j) {
        if (s[i] != s[j]) return false;
        i++; j--;
    }
    return true;
}
```

For `"level"`: compare `l`/`l`, then `e`/`e`, then the pointers meet at `v`. About n/2 steps, so O(n).

## Where you'll meet it

- Lists of items on screen, rows in a file, pixels in an image: all arrays.
- Nearly every interview opens with an array or string problem: reverse it, find duplicates, merge two lists.
- Parsing a CSV line or validating a password treats a string as an array of characters.

## Common mistakes

- **Off-by-one errors.** Looping `i <= n` reads one past the end. Use `i < n`.
- **Expecting a string to change in place.** `s[0] = 'b'` does not compile in C#. Build a new string or use a `char[]`.
- **Joining strings in a big loop.** `s += x` copies the whole string every time, O(n²) overall. Use `StringBuilder`.

```check
{"prompt": "Why is building a long string with s += piece inside a loop slow?", "options": ["Strings cannot be longer than 100 characters", "Each += creates a new string and copies all the old characters", "The loop runs backwards", "Indexes start at 1 for strings"], "answer": 1, "explanation": "Strings are immutable, so every += allocates a new string and copies the existing text into it. Over n pieces that adds up to O(n²) work. StringBuilder avoids the repeated copying."}
```

## Recap

- An **array** is a row of same-sized boxes with indexes starting at 0.
- Reading or writing by index is O(1). Inserting or deleting in the middle is O(n).
- A **string** is an array of characters, and in C# it cannot be changed in place.
- Two pointers moving through the data solve many problems in one pass.
- The last index is `Length - 1`; avoid `+=` on strings in loops.
