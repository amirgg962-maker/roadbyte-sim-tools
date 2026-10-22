import assert from "node:assert/strict";
import test from "node:test";
import { translate } from "../src/i18n.ts";

test("English remains unchanged", () => {
  assert.equal(translate("en", "Backup Center"), "Backup Center");
  assert.equal(
    translate("en", "Untranslated technical identifier"),
    "Untranslated technical identifier",
  );
});

test("Persian translates interface copy while preserving technical terms", () => {
  assert.equal(translate("fa", "Backup Center"), "مرکز پشتیبان‌گیری");
  assert.equal(translate("fa", "BSII"), "BSII");
  assert.equal(translate("fa", "Review config changes"), "بازبینی تغییرات تنظیمات");
  assert.equal(translate("fa", "Profile command center"), "اتاق فرمان پروفایل");
  assert.equal(
    translate("fa", "Untranslated technical identifier"),
    "Untranslated technical identifier",
  );
});
