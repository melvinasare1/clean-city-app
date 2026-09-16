const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const {
  appStaffAccess,
  driverActorFromDoc,
  jobAssignedToCaller,
  publicAuthError,
  staffAccessFromAdminDoc,
  staffMay,
} = require("../.test-out/authorize");

function authorizeStaffApi({ uid, staffDoc, action = "dispatch" }) {
  if (!uid) return publicAuthError("unauthenticated");
  const access = staffAccessFromAdminDoc(staffDoc);
  if (!access.allowed) return publicAuthError(access.reason);
  if (!staffMay(access.role, action)) {
    return { status: 403, error: "Not authorized" };
  }
  return { status: 200, role: access.role };
}

function authorizeDriverJobApi({ uid, driverDoc, job }) {
  if (!uid) return publicAuthError("unauthenticated");
  const actor = driverActorFromDoc(driverDoc);
  if (!actor.allowed) return publicAuthError(actor.reason);
  if (!jobAssignedToCaller(job, uid)) {
    return { status: 403, error: "Not allowed to act on this job" };
  }
  return { status: 200 };
}

describe("Admin API", () => {
  it("1. Unauthenticated request → rejected", () => {
    const result = authorizeStaffApi({ uid: null, staffDoc: null });
    assert.equal(result.status, 401);
  });

  it("2. Authenticated normal customer → rejected", () => {
    const result = authorizeStaffApi({
      uid: "cust-1",
      staffDoc: undefined,
    });
    assert.equal(result.status, 403);
  });

  it("3. Authenticated pending staff → rejected", () => {
    const result = authorizeStaffApi({
      uid: "staff-1",
      staffDoc: { role: "admin", isApproved: false },
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /not approved/i);
  });

  it("4. Authenticated denied/unapproved staff → rejected", () => {
    const result = authorizeStaffApi({
      uid: "staff-2",
      staffDoc: { role: "assistant", isApproved: false },
    });
    assert.equal(result.status, 403);
  });

  it("5. Approved assistant → allowed only for existing assistant permissions", () => {
    const dispatch = authorizeStaffApi({
      uid: "asst-1",
      staffDoc: { role: "assistant", isApproved: true },
      action: "dispatch",
    });
    assert.equal(dispatch.status, 200);
    const adminOnly = authorizeStaffApi({
      uid: "asst-1",
      staffDoc: { role: "assistant", isApproved: true },
      action: "admin_only",
    });
    assert.equal(adminOnly.status, 403);
  });

  it("6. Approved admin → allowed", () => {
    const dispatch = authorizeStaffApi({
      uid: "admin-1",
      staffDoc: { role: "admin", isApproved: true },
      action: "dispatch",
    });
    assert.equal(dispatch.status, 200);
    const adminOnly = authorizeStaffApi({
      uid: "admin-1",
      staffDoc: { role: "admin", isApproved: true },
      action: "admin_only",
    });
    assert.equal(adminOnly.status, 200);
  });
});

describe("Driver API", () => {
  it("7. Unauthenticated driver action → rejected", () => {
    const result = authorizeDriverJobApi({
      uid: null,
      driverDoc: { role: "driver", status: "approved" },
      job: { assignedTo: "drv-a" },
    });
    assert.equal(result.status, 401);
  });

  it("8. Pending driver → rejected", () => {
    const result = authorizeDriverJobApi({
      uid: "drv-a",
      driverDoc: { role: "driver", status: "pending" },
      job: { assignedTo: "drv-a" },
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /pending/i);
  });

  it("9. Suspended driver → rejected", () => {
    const result = authorizeDriverJobApi({
      uid: "drv-a",
      driverDoc: { role: "driver", status: "suspended" },
      job: { assignedTo: "drv-a" },
    });
    assert.equal(result.status, 403);
    assert.match(result.error, /suspended/i);
  });

  it("10. Approved Driver A attempting to operate Driver B's job → rejected", () => {
    const result = authorizeDriverJobApi({
      uid: "drv-a",
      driverDoc: { role: "driver", status: "approved" },
      job: { assignedTo: "drv-b" },
    });
    assert.equal(result.status, 403);
  });

  it("11. Approved assigned Driver A → allowed", () => {
    const result = authorizeDriverJobApi({
      uid: "drv-a",
      driverDoc: { role: "driver", status: "approved" },
      job: { assignedTo: "drv-a" },
    });
    assert.equal(result.status, 200);
  });
});

describe("Customer privilege escalation", () => {
  it("13. Profile role admin does not grant staff access", () => {
    const access = appStaffAccess({
      profileRole: "admin",
      adminDoc: null,
    });
    assert.equal(access.allowed, false);
  });

  it("14. Genuine approved admin still receives admin access", () => {
    const access = appStaffAccess({
      profileRole: "customer",
      adminDoc: { role: "admin", isApproved: true },
    });
    assert.equal(access.allowed, true);
    assert.equal(access.role, "admin");
  });

  it("15. Genuine approved assistant still receives assistant access", () => {
    const access = appStaffAccess({
      profileRole: "customer",
      adminDoc: { role: "assistant", isApproved: true },
    });
    assert.equal(access.allowed, true);
    assert.equal(access.role, "assistant");
  });
});

describe("Data protection", () => {
  it("16. Unauthenticated /api/jobs/list cannot retrieve data", () => {
    const result = authorizeStaffApi({ uid: null, staffDoc: null });
    assert.equal(result.status, 401);
  });

  it("17. Unauthenticated /api/drivers/list cannot retrieve data", () => {
    const result = authorizeStaffApi({ uid: null, staffDoc: null });
    assert.equal(result.status, 401);
  });
});

describe("Firestore rules source", () => {
  const rules = fs.readFileSync(
    path.join(__dirname, "../../firestore.rules"),
    "utf8"
  );

  it("12. Owner profile writes cannot set role to admin", () => {
    assert.match(rules, /request\.resource\.data\.role == 'customer'/);
    assert.match(rules, /affectedKeys\(\)[\s\S]*hasAny\(\['role'/);
    assert.doesNotMatch(
      rules,
      /get\(profilePath\(\)\)\.data\.role == 'admin'/
    );
    assert.doesNotMatch(
      rules,
      /get\(profilePath\(\)\)\.data\.role in \['admin', 'assistant'\]/
    );
  });
});
