import {
  buildAuditLogFilter,
  toExportRow,
} from "../services/auditLogExportService.js";

describe("audit log export helpers", () => {
  it("builds an organization-scoped filter with the supplied filters", () => {
    const filter = buildAuditLogFilter({
      organizationId: "organization-id",
      action: "member.added",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-01-31T23:59:59.999Z",
    });

    expect(filter).toEqual({
      organization: "organization-id",
      action: "member.added",
      createdAt: {
        $gte: new Date("2026-01-01T00:00:00.000Z"),
        $lte: new Date("2026-01-31T23:59:59.999Z"),
      },
    });
  });

  it("formats populated audit logs into safe export rows", () => {
    expect(
      toExportRow({
        createdAt: "2026-01-15T12:00:00.000Z",
        actor: { name: "Ada Lovelace", email: "ada@example.com" },
        action: "member.added",
        entity: "membership",
        entityId: { toString: () => "membership-id" },
        details: { role: "admin" },
      }),
    ).toEqual({
      timestamp: "2026-01-15T12:00:00.000Z",
      actorName: "Ada Lovelace",
      actorEmail: "ada@example.com",
      action: "member.added",
      entity: "membership",
      entityId: "membership-id",
      details: '{"role":"admin"}',
    });
  });
});
