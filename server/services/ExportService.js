import PDFDocument from "pdfkit";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  WidthType,
  HeadingLevel,
} from "docx";

class ExportService {
  /**
   * Generates a PDF Document stream for a meeting.
   * @param {Object} meetingData
   * @returns {PDFDocument} PDF document stream
   */
  static generateMeetingPDF(meetingData) {
    if (!meetingData) {
      throw new Error("Invalid meeting data provided for PDF generation");
    }

    const mom = meetingData.structuredMoM || {};
    const title = mom.title || meetingData.title || "Meeting Minutes";
    const date =
      mom.date || meetingData.date
        ? new Date(meetingData.date).toLocaleDateString()
        : "N/A";

    const doc = new PDFDocument({ margin: 50 });

    // Header
    doc
      .fontSize(24)
      .font("Helvetica-Bold")
      .text("Minutes of Meeting", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text(`Title: ${title}`);
    doc.fontSize(12).font("Helvetica").text(`Date: ${date}`);
    doc.moveDown();

    if (mom.summary) {
      doc.fontSize(14).font("Helvetica-Bold").text("Summary");
      doc.fontSize(12).font("Helvetica").text(mom.summary);
      doc.moveDown();
    }

    if (mom.attendees && mom.attendees.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Attendees");
      mom.attendees.forEach((a) =>
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`• ${a.name || a} ${a.role ? `(${a.role})` : ""}`),
      );
      doc.moveDown();
    }

    if (mom.agenda && mom.agenda.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Agenda");
      mom.agenda.forEach((a) =>
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`• ${a.text || a}`),
      );
      doc.moveDown();
    }

    if (mom.decisions && mom.decisions.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Decisions");
      mom.decisions.forEach((d) =>
        doc.fontSize(12).font("Helvetica").text(`• ${d}`),
      );
      doc.moveDown();
    }

    if (mom.action_items && mom.action_items.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Action Items");
      doc.moveDown(0.5);

      // Simple Table for Action Items
      const startX = 50;
      let startY = doc.y;
      const columnWidths = [180, 100, 100, 100];

      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Task", startX, startY);
      doc.text("Owner", startX + columnWidths[0], startY);
      doc.text(
        "Due Date",
        startX + columnWidths[0] + columnWidths[1],
        startY,
      );
      doc.text(
        "Status",
        startX + columnWidths[0] + columnWidths[1] + columnWidths[2],
        startY,
      );

      startY += 15;
      doc
        .moveTo(startX, startY)
        .lineTo(startX + 480, startY)
        .stroke();
      startY += 5;

      doc.font("Helvetica").fontSize(10);
      mom.action_items.forEach((item) => {
        const task = item.task || item.description || "N/A";
        const owner = item.owner || "Unassigned";
        const dueDate = item.due_date || item.dueDate || "N/A";
        const status = item.status || "Pending";

        const rowHeight =
          Math.max(
            doc.heightOfString(task, { width: columnWidths[0] }),
            doc.heightOfString(owner, { width: columnWidths[1] }),
            doc.heightOfString(dueDate, { width: columnWidths[2] }),
            doc.heightOfString(status, { width: columnWidths[3] }),
          ) + 10;

        if (startY + rowHeight > doc.page.height - 50) {
          doc.addPage();
          startY = 50;
          doc.font("Helvetica-Bold").fontSize(10);
          doc.text("Task", startX, startY);
          doc.text("Owner", startX + columnWidths[0], startY);
          doc.text(
            "Due Date",
            startX + columnWidths[0] + columnWidths[1],
            startY,
          );
          doc.text(
            "Status",
            startX + columnWidths[0] + columnWidths[1] + columnWidths[2],
            startY,
          );
          startY += 15;
          doc
            .moveTo(startX, startY)
            .lineTo(startX + 480, startY)
            .stroke();
          startY += 5;
          doc.font("Helvetica").fontSize(10);
        }

        doc.text(task, startX, startY, { width: columnWidths[0] });
        doc.text(owner, startX + columnWidths[0], startY, {
          width: columnWidths[1],
        });
        doc.text(
          dueDate,
          startX + columnWidths[0] + columnWidths[1],
          startY,
          { width: columnWidths[2] },
        );
        doc.text(
          status,
          startX + columnWidths[0] + columnWidths[1] + columnWidths[2],
          startY,
          { width: columnWidths[3] },
        );

        startY += rowHeight;
      });
      doc.moveDown();
    }

    if (mom.keywords && mom.keywords.length > 0) {
      doc.fontSize(14).font("Helvetica-Bold").text("Keywords");
      doc.fontSize(12).font("Helvetica").text(mom.keywords.join(", "));
    }

    doc.end();
    return doc;
  }

  /**
   * Generates a DOCX Buffer for a meeting.
   * @param {Object} meetingData
   * @returns {Promise<Buffer>} DOCX buffer
   */
  static async generateMeetingDOCX(meetingData) {
    if (!meetingData) {
      throw new Error("Invalid meeting data provided for DOCX generation");
    }

    const mom = meetingData.structuredMoM || {};
    const title = mom.title || meetingData.title || "Meeting Minutes";
    const date =
      mom.date || meetingData.date
        ? new Date(meetingData.date).toLocaleDateString()
        : "N/A";

    const children = [
      new Paragraph({
        text: "Minutes of Meeting",
        heading: HeadingLevel.HEADING_1,
        alignment: "center",
      }),
      new Paragraph({
        text: `Title: ${title}`,
        heading: HeadingLevel.HEADING_2,
      }),
      new Paragraph({ text: `Date: ${date}` }),
      new Paragraph({ text: "" }),
    ];

    if (mom.summary) {
      children.push(
        new Paragraph({ text: "Summary", heading: HeadingLevel.HEADING_3 }),
      );
      children.push(new Paragraph({ text: mom.summary }));
      children.push(new Paragraph({ text: "" }));
    }

    if (mom.attendees && mom.attendees.length > 0) {
      children.push(
        new Paragraph({ text: "Attendees", heading: HeadingLevel.HEADING_3 }),
      );
      mom.attendees.forEach((a) => {
        children.push(
          new Paragraph({
            text: `• ${a.name || a} ${a.role ? `(${a.role})` : ""}`,
          }),
        );
      });
      children.push(new Paragraph({ text: "" }));
    }

    if (mom.agenda && mom.agenda.length > 0) {
      children.push(
        new Paragraph({ text: "Agenda", heading: HeadingLevel.HEADING_3 }),
      );
      mom.agenda.forEach((a) =>
        children.push(new Paragraph({ text: `• ${a.text || a}` })),
      );
      children.push(new Paragraph({ text: "" }));
    }

    if (mom.decisions && mom.decisions.length > 0) {
      children.push(
        new Paragraph({ text: "Decisions", heading: HeadingLevel.HEADING_3 }),
      );
      mom.decisions.forEach((d) =>
        children.push(new Paragraph({ text: `• ${d}` })),
      );
      children.push(new Paragraph({ text: "" }));
    }

    if (mom.action_items && mom.action_items.length > 0) {
      children.push(
        new Paragraph({
          text: "Action Items",
          heading: HeadingLevel.HEADING_3,
        }),
      );

      const tableRows = [
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: "Task", style: "Strong" })],
            }),
            new TableCell({
              children: [new Paragraph({ text: "Owner", style: "Strong" })],
            }),
            new TableCell({
              children: [
                new Paragraph({ text: "Due Date", style: "Strong" }),
              ],
            }),
            new TableCell({
              children: [new Paragraph({ text: "Status", style: "Strong" })],
            }),
          ],
        }),
      ];

      mom.action_items.forEach((item) => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    text: item.task || item.description || "N/A",
                  }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({ text: item.owner || "Unassigned" }),
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    text: item.due_date || item.dueDate || "N/A",
                  }),
                ],
              }),
              new TableCell({
                children: [new Paragraph({ text: item.status || "Pending" })],
              }),
            ],
          }),
        );
      });

      const table = new Table({
        rows: tableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
      });

      children.push(table);
      children.push(new Paragraph({ text: "" }));
    }

    if (mom.keywords && mom.keywords.length > 0) {
      children.push(
        new Paragraph({ text: "Keywords", heading: HeadingLevel.HEADING_3 }),
      );
      children.push(new Paragraph({ text: mom.keywords.join(", ") }));
    }

    const doc = new Document({
      sections: [{ properties: {}, children: children }],
    });

    return Packer.toBuffer(doc);
  }

  /**
   * Generates a Markdown string for a meeting.
   * @param {Object} meetingData
   * @returns {string} Markdown string
   */
  static generateMeetingMD(meetingData) {
    if (!meetingData) {
      throw new Error("Invalid meeting data provided for MD generation");
    }

    const mom = meetingData.structuredMoM || {};
    const title = mom.title || meetingData.title || "Meeting Minutes";
    const date =
      mom.date || meetingData.date
        ? new Date(meetingData.date).toLocaleDateString()
        : "N/A";

    let md = `# Minutes of Meeting\n\n`;
    md += `**Title:** ${title}\n`;
    md += `**Date:** ${date}\n\n`;

    if (mom.summary) {
      md += `## Summary\n${mom.summary}\n\n`;
    }

    if (mom.attendees && mom.attendees.length > 0) {
      md += `## Attendees\n`;
      mom.attendees.forEach(
        (a) => (md += `- ${a.name || a} ${a.role ? `(${a.role})` : ""}\n`),
      );
      md += `\n`;
    }

    if (mom.agenda && mom.agenda.length > 0) {
      md += `## Agenda\n`;
      mom.agenda.forEach((a) => (md += `- ${a.text || a}\n`));
      md += `\n`;
    }

    if (mom.decisions && mom.decisions.length > 0) {
      md += `## Decisions\n`;
      mom.decisions.forEach((d) => (md += `- ${d}\n`));
      md += `\n`;
    }

    if (mom.action_items && mom.action_items.length > 0) {
      md += `## Action Items\n`;
      md += `| Task | Owner | Due Date | Status |\n`;
      md += `|---|---|---|---|\n`;
      mom.action_items.forEach((item) => {
        const task = (item.task || item.description || "N/A")
          .toString()
          .replace(/\\/g, "\\\\")
          .replace(/\|/g, "\\|");
        const owner = (item.owner || "Unassigned")
          .toString()
          .replace(/\\/g, "\\\\")
          .replace(/\|/g, "\\|");
        const dueDate = (item.due_date || item.dueDate || "N/A")
          .toString()
          .replace(/\\/g, "\\\\")
          .replace(/\|/g, "\\|");
        const status = (item.status || "Pending")
          .toString()
          .replace(/\\/g, "\\\\")
          .replace(/\|/g, "\\|");
        md += `| ${task} | ${owner} | ${dueDate} | ${status} |\n`;
      });
      md += `\n`;
    }

    if (mom.keywords && mom.keywords.length > 0) {
      md += `## Keywords\n${mom.keywords.join(", ")}\n`;
    }

    return md;
  }
}

export default ExportService;
