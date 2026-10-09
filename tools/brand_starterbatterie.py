"""Add approved vector branding without changing the existing PDF form."""
import argparse
import io
from pathlib import Path

import fitz
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import ContentStream, NameObject
from reportlab.lib.colors import HexColor
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


def vector_page(svg):
    with fitz.open(stream=Path(svg).read_bytes(), filetype="svg") as document:
        return document.convert_to_pdf()


def field_snapshot(reader):
    keys = ("/FT", "/Ff", "/V", "/DV", "/MaxLen")
    return {
        name: {key: str(field.get(key, "")) for key in keys}
        for name, field in (reader.get_fields() or {}).items()
    }


def widget_snapshot(reader):
    return [
        [(str(widget.get("/T", "")), tuple(widget["/Rect"]), str(widget.get("/V", "")))
         for annotation in page.get("/Annots", [])
         if (widget := annotation.get_object()).get("/Subtype") == "/Widget"]
        for page in reader.pages
    ]


def add_brand(source, output, raven, wordmark):
    reader = PdfReader(source)
    if any(field.get("/FT") == "/Sig" for field in (reader.get_fields() or {}).values()):
        raise ValueError("Signed forms require a separate workflow.")
    if any("kramurai.github.io" in (page.extract_text() or "") for page in reader.pages):
        raise ValueError("Use the unbranded source to avoid adding the footer twice.")
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    raven_pdf, wordmark_pdf = vector_page(raven), vector_page(wordmark)
    for page in writer.pages:
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        overlay_buffer = io.BytesIO()
        drawing = canvas.Canvas(overlay_buffer, pagesize=(width, height))
        drawing.setFillColor(HexColor("#0F4C5C"))
        text = drawing.beginText(92, 84)
        text.setFont("Helvetica-Bold", 7.2)
        text.setCharSpace(0)
        text.setWordSpace(0)
        text.setHorizScale(100)
        text.textOut("Einfach. Nützlich. Kostenlos.")
        drawing.drawText(text)
        address = "kramurai.github.io"
        text = drawing.beginText(width - 51.02362 - stringWidth(address, "Helvetica", 8), 88)
        text.setFont("Helvetica", 8)
        text.setCharSpace(0)
        text.setWordSpace(0)
        text.setHorizScale(100)
        text.textOut(address)
        drawing.drawText(text)
        drawing.linkURL("https://kramurai.github.io/", (width - 135, 85, width - 51.02362, 98), relative=0)
        drawing.save()
        overlay = PdfReader(io.BytesIO(overlay_buffer.getvalue())).pages[0]
        for content, target_width, x, y in [(raven_pdf, 34, 51.02362, 88), (wordmark_pdf, 112, 92, 94)]:
            graphic = PdfReader(io.BytesIO(content)).pages[0]
            scale = target_width / float(graphic.mediabox.width)
            overlay.merge_transformed_page(graphic, Transformation().scale(scale).translate(x, y))
        page.merge_page(overlay)
    writer.add_metadata({
        "/Title": "Kramurai - Entsorgungsnachweis für Fahrzeug-Starterbatterien",
        "/Author": "Kramurai",
        "/Subject": "Ausfüllbare Vorlage mit unverändertem Formularinhalt und Kramurai-Marke",
    })
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("wb") as stream:
        writer.write(stream)
    result = PdfReader(output)
    assert field_snapshot(reader) == field_snapshot(result), "Field definitions or values changed"
    assert widget_snapshot(reader) == widget_snapshot(result), "Widget positions or values changed"
    assert len(reader.pages) == len(result.pages)
    for before, after in zip(reader.pages, result.pages):
        assert before.mediabox == after.mediabox
        assert (before.extract_text() or "") in (after.extract_text() or ""), "Original text changed"
    return result


def replace_header_images(source, output, raven, wordmark):
    """Replace only the two existing raster brand assets in the v1.4 header."""
    reader = PdfReader(source)
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    for old_page, page in zip(reader.pages, writer.pages):
        old_images = old_page["/Resources"]["/XObject"]
        names = set()
        for name, reference in old_images.items():
            item = reference.get_object()
            if item.get("/Subtype") == "/Image" and (item.get("/Width"), item.get("/Height")) in {(119, 120), (800, 153)}:
                names.add(name)
        assert len(names) == 2, "Unexpected template artwork"
        stream = ContentStream(page.get_contents(), writer)
        removed = sum(operator == b"Do" and operands[0] in names for operands, operator in stream.operations)
        assert removed == 2, "Unexpected artwork placements"
        stream.operations = [(operands, operator) for operands, operator in stream.operations
                             if not (operator == b"Do" and operands[0] in names)]
        page[NameObject("/Contents")] = writer._add_object(stream)
        for name in names:
            page["/Resources"]["/XObject"].pop(name, None)
        for svg, x, top, target_width, target_height in [(raven, 54, 24, 38.675, 39), (wordmark, 107, 26, 162.0915, 31)]:
            graphic = PdfReader(io.BytesIO(vector_page(svg))).pages[0]
            gw, gh = float(graphic.mediabox.width), float(graphic.mediabox.height)
            scale = min(target_width / gw, target_height / gh)
            y = float(page.mediabox.height) - top - (target_height + gh * scale) / 2
            page.merge_transformed_page(graphic, Transformation().scale(scale).translate(x, y))
    with Path(output).open("wb") as stream:
        writer.write(stream)
    result = PdfReader(output)
    assert field_snapshot(reader) == field_snapshot(result)
    assert widget_snapshot(reader) == widget_snapshot(result)
    assert len(reader.pages) == len(result.pages)
    for before, after in zip(reader.pages, result.pages):
        assert before.mediabox == after.mediabox
        assert (before.extract_text() or "") == (after.extract_text() or "")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    for argument in ["source", "output", "raven", "wordmark"]:
        parser.add_argument("--" + argument, required=True)
    parser.add_argument("--replace-header-images", action="store_true")
    args = parser.parse_args()
    operation = replace_header_images if args.replace_header_images else add_brand
    result = operation(args.source, args.output, args.raven, args.wordmark)
    print(f"Validated {len(result.pages)} pages and {len(result.get_fields() or {})} preserved fields.")
