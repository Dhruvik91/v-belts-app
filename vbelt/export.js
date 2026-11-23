/* ==========================================================================
   Export helpers — PDF (jsPDF + autoTable) and Excel (SheetJS).
   Libraries are bundled in vendor/ so exports work offline from the USB drive.

   columns: [{ header: "Qty", type: "number" | "text", width: 10 }]
   rows:    array of arrays, same order as columns
   ========================================================================== */

(function () {
    const COMPANY = "PATEL V BELT CORPORATION";

    function stamp() {
        const d = new Date();
        const p = n => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }

    function ensure(libOk, name) {
        if (libOk) return true;
        if (window.showToast) showToast(`${name} export library failed to load`, "error");
        return false;
    }

    function pdf({ title, subtitle, columns, rows, filename, landscape = false }) {
        if (!ensure(window.jspdf && window.jspdf.jsPDF, "PDF")) return;
        if (!rows.length) {
            showToast("Nothing to export", "warning");
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF(landscape ? "l" : "p", "mm", "a4");
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const generated = new Date().toLocaleString();

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(COMPANY, 14, 14);

        doc.setFontSize(16);
        doc.setTextColor(10, 10, 10);
        doc.text(title, 14, 22);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(subtitle ? `${subtitle}  ·  Generated ${generated}` : `Generated ${generated}`, 14, 28);

        const columnStyles = {};
        columns.forEach((c, i) => {
            if (c.type === "number") columnStyles[i] = { halign: "right" };
        });

        doc.autoTable({
            startY: 33,
            head: [columns.map(c => c.header)],
            body: rows.map(r => r.map(v => (v === null || v === undefined || v === "") ? "-" : String(v))),
            theme: "plain",
            styles: { font: "helvetica", fontSize: 9, cellPadding: { top: 2.4, bottom: 2.4, left: 3, right: 3 }, textColor: [10, 10, 10], lineColor: [234, 234, 234] },
            headStyles: { fillColor: [244, 244, 244], textColor: [107, 114, 128], fontStyle: "bold", fontSize: 8.5 },
            bodyStyles: { fillColor: [255, 255, 255], lineWidth: { bottom: 0.2 } },
            alternateRowStyles: { fillColor: [255, 255, 255] },
            columnStyles,
            margin: { left: 14, right: 14, bottom: 16 },
            didParseCell: data => {
                if (data.section === "head" && columns[data.column.index].type === "number") {
                    data.cell.styles.halign = "right";
                }
                // Highlight low-stock / cut rows when the caller marks them
                const raw = rows[data.row.index];
                if (data.section === "body" && raw && raw.__highlight) {
                    data.cell.styles.fillColor = [254, 242, 242];
                }
            },
            didDrawPage: () => {
                doc.setFontSize(8);
                doc.setTextColor(156, 163, 175);
                const page = doc.internal.getCurrentPageInfo().pageNumber;
                doc.text(`Page ${page}`, pageW - 14, pageH - 8, { align: "right" });
                doc.text(title, 14, pageH - 8);
            }
        });

        doc.save(`${filename}-${stamp()}.pdf`);
        showToast("PDF downloaded", "success");
    }

    function excel({ sheetName, columns, rows, filename }) {
        if (!ensure(window.XLSX, "Excel")) return;
        if (!rows.length) {
            showToast("Nothing to export", "warning");
            return;
        }

        const data = [
            columns.map(c => c.header),
            ...rows.map(r => r.map((v, i) => {
                if (columns[i].type === "number") {
                    const n = Number(v);
                    return v === "" || v === null || v === undefined || isNaN(n) ? "" : n;
                }
                return v === null || v === undefined ? "" : String(v);
            }))
        ];

        const ws = XLSX.utils.aoa_to_sheet(data);
        ws["!cols"] = columns.map((c, i) => ({
            wch: c.width || Math.min(40, Math.max(c.header.length, ...data.slice(1).map(r => String(r[i]).length)) + 2)
        }));
        ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length - 1, c: columns.length - 1 } }) };

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
        XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
        showToast("Excel file downloaded", "success");
    }

    window.Exporter = { pdf, excel };
})();
