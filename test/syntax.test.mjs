import test from "node:test";
import assert from "node:assert/strict";
import { SYNTAX, CONSTRUCTS, SYNTAX_NOTES, CONDITIONAL } from "../src/lib/syntax.js";

// The parser can name a construct; the client has to have a sentence for it.
test("every operator the parser knows has a note", () => {
  for (const section of Object.values(SYNTAX)) {
    assert.ok(SYNTAX_NOTES[section], `no note for ${section}`);
  }
});

test("every compound command has a note", () => {
  for (const construct of Object.values(CONSTRUCTS)) {
    assert.ok(SYNTAX_NOTES[construct.label], `no note for ${construct.label}`);
  }
});

test("the loops and conditionals each have their own sentence", () => {
  for (const title of ["for loop", "while loop", "until loop", "if statement", "case statement", "select loop"]) {
    assert.ok(SYNTAX_NOTES[title], `no note for ${title}`);
    assert.notEqual(SYNTAX_NOTES[title], SYNTAX_NOTES[CONDITIONAL], `${title} falls back to the section note`);
  }
});
