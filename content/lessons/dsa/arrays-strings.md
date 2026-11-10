---
title: "Arrays & strings"
summary: "How a row of numbered boxes in memory works, and why a string is just an array of characters."
---

## The idea

Think of a row of lockers in a school hallway, numbered 0, 1, 2, 3 and so on. Each locker holds one thing. If someone says "open locker 7", you walk straight to it. You do not check lockers 0 to 6 first.

An **array** is exactly that: a fixed row of boxes, side by side in memory, each holding one value. The number of a box is its **index**, and counting starts at **0**. An array of 5 items has indexes 0 to 4.

Arrays are the simplest and most used data structure. Almost everything else is built on top of them. A **data structure** is just a way of organizing data so some jobs become easy.

## See it work

```csharp
int[] scores = { 90, 72, 85, 60 };
int first = scores[0];    // 90
scores[2] = 99;           // replace 85
int n = scores.Length;    // 4
```

In memory it looks like this:

```
index:   0    1    2    3
       +----+----+----+----+
       | 90 | 72 | 99 | 60 |
       +----+----+----+----+
```

Why is `scores[2]` instant? The boxes sit side by side, each the same size. The computer takes the address where the array starts and adds `2 × (size of one box)`. One calculation, whatever the array size. That is **O(1)** access. (If O(1) is new, read *Big-O, from scratch* first.)

```check
{"prompt": "An array has 6 items. What is the index of the last one?", "options": ["6", "5", "7", "1"], "answer": 1, "explanation": "Indexes start at 0, so six items use indexes 0, 1, 2, 3, 4, 5. The last index is always length minus 1."}
```

## How it works

An array has a fixed size. To add a new item in the middle, everything after it must shift one place right to make room:

```
insert 50 at index 1:
before: [ 90 | 72 | 99 | 60 ]
shift:  [ 90 |    | 72 | 99 | 60 ]
after:  [ 90 | 50 | 72 | 99 | 60 ]
```

Shifting touches up to n items, so inserting or deleting in the middle is **O(n)**. Reading or writing by index is **O(1)**. Searching for a value you do not know the position of is **O(n)**, since you check each box.

If you do not know the size up front, use a **resizable array**: `List<T>` in C#. It is an array that, when full, quietly makes a bigger one and copies everything over. Adding at the end is still cheap on average.

A **string** is an array of characters. `"hello"` is the boxes `h e l l o` at indexes 0 to 4, so `s[1]` is `'e'`. In C# strings are **immutable**: you cannot change a character in place. Every "change" builds a new string.

```csharp
string s = "cat";
string t = s + "s";   // a brand new string "cats"
```

```check
{"prompt": "You have an array of 1,000 items and insert a new item at the very front. Roughly how many items must move?", "options": ["None", "1", "About 1,000", "About 10"], "answer": 2, "explanation": "Every existing item has to slide one place right to free index 0. That is n moves, so inserting at the front is O(n)."}
```

A handy technique is the **two pointers** trick. You keep two indexes and move them toward each other. Here is a check for a palindrome (a word that reads the same backwards):

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

Trace `"level"`: compare `l`/`l`, then `e`/`e`, then the pointers meet at `v`. It returns true after about n/2 steps, so O(n).

## Where you'll meet it

- Lists of items on a screen, rows in a file, pixels in an image: all arrays.
- Nearly every interview starts with an array or string problem: reverse it, find duplicates, merge two lists.
- Text processing, such as parsing a CSV line or checking a password, works on strings as arrays of characters.

## Common mistakes

- **Off-by-one errors.** Looping `i <= n` reads one past the end and throws an `IndexOutOfRangeException`. Use `i < n`.
- **Expecting a string to change in place.** `s[0] = 'b'` does not compile in C#. Build a new string or use a `char[]`.
- **Joining strings in a big loop.** `s += x` copies the whole string every time, giving O(n²) overall. Use `StringBuilder`.
- **Mixing up length and last index.** The last index is `Length - 1`.

```check
{"prompt": "Why is building a long string with s += piece inside a loop slow?", "options": ["Strings cannot be longer than 100 characters", "Each += creates a new string and copies all the old characters", "The loop runs backwards", "Indexes start at 1 for strings"], "answer": 1, "explanation": "Strings are immutable, so every += allocates a new string and copies the existing text into it. Over n pieces that adds up to O(n²) work. StringBuilder avoids the repeated copying."}
```

## Recap

- An **array** is a row of same-sized boxes with indexes starting at 0.
- Reading or writing by index is O(1). Inserting or deleting in the middle is O(n).
- A **string** is an array of characters, and in C# it cannot be changed in place.
- Two indexes moving through the data (two pointers) solve many problems in one pass.
- Watch the last index (`Length - 1`) and avoid `+=` on strings in loops.
