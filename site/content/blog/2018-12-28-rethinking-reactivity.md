---
title: Rethinking reactivity
description: We turned JavaScript into a reactive programming language, and it's a lot of fun
pubdate: 2018-12-28
author: Rich Harris
authorURL: https://twitter.com/Rich_Harris
---

Consider the spreadsheet.

Each cell can contain a value or a *formula* — which is to say, a pure function whose arguments are other cells. When we edit a cell, something miraculous happens: other cells that depend on its value will immediately update. If they have dependencies of their own, updates will cascade through the spreadsheet.

<aside><p>This was the approach taken by VisiCalc, the first mass-market spreadsheet program. In fact, you had to <em>manually</em> trigger recalculations until the sheet had 'settled'.</p></aside>

If you were building a spreadsheet program, there are a couple of ways you could implement this behaviour. A simple but naïve way is to simply recalculate *everything* on *every* state change — in other words, 're-render the world'. But that's no good if you're running the program on resource-constrained hardware.

A more sophisticated approach is to keep track of which cells depend on which other cells, so that you can propagate changes to the affected formulas while leaving the rest of the spreadsheet untouched. This idea, central to modern software, is 50 years old — it was the foundation of LANPAR, the OG spreadsheet program, released in 1969. Back then it was described as 'forward referencing/natural order calculation'.

Today, we call it 'reactive programming'.

...