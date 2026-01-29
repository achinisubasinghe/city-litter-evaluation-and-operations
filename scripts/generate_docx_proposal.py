#!/usr/bin/env python3
"""
Populates docs/Proposal Template.docx with unslop-compliant CLEO proposal content.
Ensures document does not exceed 2 pages.
"""

import copy
import io
import os
import re
import zipfile
import xml.etree.ElementTree as ET

NAMESPACES = {
    'wpc': 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
    'cx': 'http://schemas.microsoft.com/office/drawing/2014/chartex',
    'cx1': 'http://schemas.microsoft.com/office/drawing/2015/9/8/chartex',
    'cx2': 'http://schemas.microsoft.com/office/drawing/2015/10/21/chartex',
    'cx3': 'http://schemas.microsoft.com/office/drawing/2016/5/9/chartex',
    'cx4': 'http://schemas.microsoft.com/office/drawing/2016/5/10/chartex',
    'cx5': 'http://schemas.microsoft.com/office/drawing/2016/5/11/chartex',
    'cx6': 'http://schemas.microsoft.com/office/drawing/2016/5/12/chartex',
    'cx7': 'http://schemas.microsoft.com/office/drawing/2016/5/13/chartex',
    'cx8': 'http://schemas.microsoft.com/office/drawing/2016/5/14/chartex',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'aink': 'http://schemas.microsoft.com/office/drawing/2016/ink',
    'am3d': 'http://schemas.microsoft.com/office/drawing/2017/model3d',
    'o': 'urn:schemas-microsoft-com:office:office',
    'oel': 'http://schemas.microsoft.com/office/2019/extlst',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'm': 'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'v': 'urn:schemas-microsoft-com:vml',
    'wp14': 'http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'w10': 'urn:schemas-microsoft-com:office:word',
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'w14': 'http://schemas.microsoft.com/office/word/2010/wordml',
    'w15': 'http://schemas.microsoft.com/office/word/2012/wordml',
    'w16cei': 'http://schemas.microsoft.com/office/word/2026/wordml/cei',
    'w16cex': 'http://schemas.microsoft.com/office/word/2018/wordml/cex',
    'w16cid': 'http://schemas.microsoft.com/office/word/2016/wordml/cid',
}

for prefix, uri in NAMESPACES.items():
    ET.register_namespace(prefix, uri)

W = f"{{{NAMESPACES['w']}}}"


def create_run(text, bold=False, italic=False, font_size_pt=10):
    r = ET.Element(f"{W}r")
    rPr = ET.SubElement(r, f"{W}rPr")

    rFonts = ET.SubElement(rPr, f"{W}rFonts")
    rFonts.set(f"{W}ascii", "Times New Roman")
    rFonts.set(f"{W}hAnsi", "Times New Roman")
    rFonts.set(f"{W}cs", "Times New Roman")

    if bold:
        ET.SubElement(rPr, f"{W}b")
        ET.SubElement(rPr, f"{W}bCs")
    if italic:
        ET.SubElement(rPr, f"{W}i")
        ET.SubElement(rPr, f"{W}iCs")

    sz = ET.SubElement(rPr, f"{W}sz")
    sz.set(f"{W}val", str(int(font_size_pt * 2)))

    t = ET.SubElement(r, f"{W}t")
    t.text = text
    if text.startswith(" ") or text.endswith(" "):
        t.set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    return r


def create_paragraph(runs, space_after=50, is_bullet=False):
    p = ET.Element(f"{W}p")
    pPr = ET.SubElement(p, f"{W}pPr")

    sp = ET.SubElement(pPr, f"{W}spacing")
    sp.set(f"{W}after", str(space_after))
    sp.set(f"{W}line", "215")
    sp.set(f"{W}lineRule", "auto")

    if is_bullet:
        ind = ET.SubElement(pPr, f"{W}ind")
        ind.set(f"{W}left", "240")
        ind.set(f"{W}hanging", "140")

    for r in runs:
        p.append(r)
    return p


def populate_cell(tc, paragraphs):
    tcPr = tc.find(f"{W}tcPr")
    for child in list(tc):
        if child != tcPr:
            tc.remove(child)
    for p in paragraphs:
        tc.append(p)


def build_proposal_docx(template_path, output_path):
    with zipfile.ZipFile(template_path, 'r') as zin:
        xml_bytes = zin.read('word/document.xml')
        tree = ET.fromstring(xml_bytes)

        body = tree.find(f"{W}body")
        main_table = body[2]
        rows = main_table.findall(f"{W}tr")

        # Row 0: Title
        r0_cells = rows[0].findall(f"{W}tc")
        populate_cell(r0_cells[1], [
            create_paragraph([
                create_run("CLEO (Clean Living Environment Observer): Automated Roadside Waste Detection System", bold=True, font_size_pt=10.5)
            ], space_after=15)
        ])

        # Row 1: Date
        r1_cells = rows[1].findall(f"{W}tc")
        populate_cell(r1_cells[1], [
            create_paragraph([
                create_run("November 8, 2026", font_size_pt=10)
            ], space_after=15)
        ])

        # Row 2: Prepared by
        r2_cells = rows[2].findall(f"{W}tc")
        populate_cell(r2_cells[1], [
            create_paragraph([
                create_run("NAME: ", bold=True, font_size_pt=10),
                create_run("[Student Name]", font_size_pt=10)
            ], space_after=15)
        ])
        populate_cell(r2_cells[2], [
            create_paragraph([
                create_run("INDEX: ", bold=True, font_size_pt=10),
                create_run("[Student Index]", font_size_pt=10)
            ], space_after=15)
        ])

        # Row 3: Supervisor
        r3_cells = rows[3].findall(f"{W}tc")
        populate_cell(r3_cells[1], [
            create_paragraph([
                create_run("[Supervisor Name]", font_size_pt=10)
            ], space_after=15)
        ])

        # Row 5: Problem statement
        r5_cell = rows[5].findall(f"{W}tc")[0]
        populate_cell(r5_cell, [
            create_paragraph([
                create_run(
                    "Roadside litter accumulates along public streets in Sri Lanka when scheduled garbage collections miss scattered waste or unrecorded dump sites. This waste sits uncollected for months. Rainwater collects in discarded containers. Mosquitoes breed in this stagnant water and spread dengue and other vector-borne diseases.",
                    font_size_pt=9.5
                )
            ], space_after=30),
            create_paragraph([
                create_run(
                    "Local authorities in Sri Lanka, including Municipal Councils, Urban Councils (Nagara Sabha), and Pradeshiya Sabha, assign workers to clean roads. These authorities lack real-time data on where waste accumulates. Municipal collection trucks follow fixed routes and do not record uncollected piles. Private contractors and public crews respond only after residents submit manual telephone complaints. Supervisors cannot track whether workers completed cleanup tasks, and residents have no direct method to track reported incidents.",
                    font_size_pt=9.5
                )
            ], space_after=25)
        ])

        # Row 7: Proposed solution
        r7_cell = rows[7].findall(f"{W}tc")[0]
        populate_cell(r7_cell, [
            create_paragraph([
                create_run(
                    "CLEO is an automated waste management system combining vehicle-mounted edge computing, citizen crowdsourcing, and closed-loop task verification across four components:",
                    font_size_pt=9.5
                )
            ], space_after=15),
            create_paragraph([
                create_run("1. Edge IoT Unit: ", bold=True, font_size_pt=9.5),
                create_run("Mounted on garbage trucks (Raspberry Pi 4B, camera, GPS, accelerometer, driver status LED). Operates 100% offline during routes, stores data in SQLite on SD card, connects automatically to depot Wi-Fi, uploads queued records, and pulses the LED to signal safe vehicle shutdown.", font_size_pt=9.5)
            ], space_after=15, is_bullet=True),
            create_paragraph([
                create_run("2. Citizen Reporting: ", bold=True, font_size_pt=9.5),
                create_run("Residents submit waste photos and GPS pins through WhatsApp (Meta Cloud API) or a mobile web interface.", font_size_pt=9.5)
            ], space_after=15, is_bullet=True),
            create_paragraph([
                create_run("3. Municipal Dashboard: ", bold=True, font_size_pt=9.5),
                create_run("Web dashboard for local council officers to filter incidents by council boundary, inspect waste categories, and dispatch tasks to workers.", font_size_pt=9.5)
            ], space_after=15, is_bullet=True),
            create_paragraph([
                create_run("4. Worker Mobile App: ", bold=True, font_size_pt=9.5),
                create_run("React Native app for sanitation crews to navigate to assigned coordinates and submit post-cleanup photos.", font_size_pt=9.5)
            ], space_after=15, is_bullet=True),
            create_paragraph([
                create_run(
                    "A two-stage classification pipeline handles evaluation: Stage 1 runs a MobileNetV2 binary classifier on the edge and citizen uploads; Stage 2 runs an asynchronous FastAPI model on the backend to classify waste into plastic, organic, glass, metal, or construction debris.",
                    font_size_pt=9.5
                )
            ], space_after=25)
        ])

        # Row 9: Objectives & Deliverables
        r9_cell = rows[9].findall(f"{W}tc")[0]
        populate_cell(r9_cell, [
            create_paragraph([create_run("Objectives:", bold=True, font_size_pt=9.5)], space_after=10),
            create_paragraph([create_run("• Detect roadside waste automatically from moving collection trucks during routine routes without cellular access.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Provide citizen reporting through WhatsApp and web browsers without an app store download.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Prevent duplicate records by merging reports submitted within a 20-meter radius.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Verify site cleanup by comparing pre-cleanup and post-cleanup photos with the image classifier.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Track municipal metrics aligned with UN Sustainable Development Goal 11, Target 11.6.", font_size_pt=9.5)], space_after=15, is_bullet=True),
            create_paragraph([create_run("Deliverables:", bold=True, font_size_pt=9.5)], space_after=10),
            create_paragraph([create_run("• Edge hardware unit (RPi 4B, camera, GPS, accelerometer, driver status LED, SQLite storage, depot sync daemon).", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• MobileNetV2 binary model exported to ONNX and backend FastAPI multi-class waste model.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Convex cloud backend with 20m spatial deduplication and Meta WhatsApp Cloud API webhooks.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Responsive React admin dashboard and React Native Android worker mobile application.", font_size_pt=9.5)], space_after=25, is_bullet=True),
        ])

        # Row 11: Target users
        r11_cell = rows[11].findall(f"{W}tc")[0]
        populate_cell(r11_cell, [
            create_paragraph([create_run("• Municipal officers and public health inspectors at Municipal Councils, Urban Councils, and Pradeshiya Sabha.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Sanitation field workers and cleanup crews managing street waste collection.", font_size_pt=9.5)], space_after=12, is_bullet=True),
            create_paragraph([create_run("• Residents who report uncollected waste in their local communities.", font_size_pt=9.5)], space_after=25, is_bullet=True),
        ])

        # Row 13: Core features
        r13_cell = rows[13].findall(f"{W}tc")[0]
        populate_cell(r13_cell, [
            create_paragraph([
                create_run("• Autonomous edge detection: ", bold=True, font_size_pt=9.5),
                create_run("Truck unit uses accelerometer data to discard blurred frames during vibration and pauses capture when stopped.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Offline storage and depot sync: ", bold=True, font_size_pt=9.5),
                create_run("Operates offline during routes. Persists photos in SQLite on SD card. Connects to depot Wi-Fi automatically. Driver LED blinks during upload and switches to a distinct pulse when done. 7-day retention with 1 GB disk guard.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Spatial deduplication: ", bold=True, font_size_pt=9.5),
                create_run("Merges new reports within 20m of open incidents, incrementing a verification counter instead of duplicating pins.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Two-stage classification: ", bold=True, font_size_pt=9.5),
                create_run("MobileNetV2 detects waste presence; cloud model classifies plastic, organic, glass, metal, and construction debris.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Task dispatch and tracking: ", bold=True, font_size_pt=9.5),
                create_run("Officers assign tickets to workers; dashboard logs officer ID, worker ID, and dispatch timestamps.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Before-and-after verification: ", bold=True, font_size_pt=9.5),
                create_run("Workers upload post-cleanup photos; classifier verifies the area is clean (litter score < 0.40) before sign-off.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• SDG 11.6 analytics: ", bold=True, font_size_pt=9.5),
                create_run("Tracks total cleanups, resolution turnaround times, waste distributions, and recurrent dumping hotspots.", font_size_pt=9.5)
            ], space_after=25, is_bullet=True),
        ])

        # Row 15: Technologies to be used
        r15_cell = rows[15].findall(f"{W}tc")[0]
        populate_cell(r15_cell, [
            create_paragraph([
                create_run("• Hardware: ", bold=True, font_size_pt=9.5),
                create_run("Raspberry Pi 4B, Camera Module, NEO-6M GPS (UART), MPU-6050 IMU (I2C), GPIO driver status LED, MicroSD storage.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Machine learning: ", bold=True, font_size_pt=9.5),
                create_run("PyTorch, ONNX Runtime, OpenCV, MobileNetV2 binary classifier, multi-class categorization network.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Backend and cloud: ", bold=True, font_size_pt=9.5),
                create_run("Convex reactive cloud database and file storage, Python FastAPI inference microservice.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Web and communication: ", bold=True, font_size_pt=9.5),
                create_run("React 18, Vite, TypeScript, Tailwind CSS, Meta WhatsApp Business Cloud API.", font_size_pt=9.5)
            ], space_after=12, is_bullet=True),
            create_paragraph([
                create_run("• Mobile application: ", bold=True, font_size_pt=9.5),
                create_run("React Native, Expo, Google Maps SDK.", font_size_pt=9.5)
            ], space_after=25, is_bullet=True),
        ])

        # Row 17: Novelty
        r17_cell = rows[17].findall(f"{W}tc")[0]
        populate_cell(r17_cell, [
            create_paragraph([
                create_run(
                    "Existing waste management systems in Sri Lanka rely on fixed truck schedules or manual phone complaints. CLEO combines passive vehicle sensing and citizen reporting into a single system. Edge units on existing municipal trucks inspect streets during routine runs without extra fuel or driver effort. The 20-meter deduplication engine merges overlapping truck and citizen submissions. This prevents duplicate work orders. Finally, the system requires image-based AI verification of the cleaned site before closing a ticket. This provides measurable accountability for municipal cleanup operations.",
                    font_size_pt=9.5
                )
            ], space_after=25)
        ])

        # Row 19: Timeline & Milestones (nested table)
        r19_cell = rows[19].findall(f"{W}tc")[0]
        nested_tbl = r19_cell.find(f".//{W}tbl")
        if nested_tbl is not None:
            nested_rows = nested_tbl.findall(f"{W}tr")
            # Row 1 (Phase 1)
            p1_cells = nested_rows[1].findall(f"{W}tc")
            populate_cell(p1_cells[1], [
                create_paragraph([
                    create_run("Model training, edge hardware assembly, and on-device testing (MobileNetV2 ONNX model, sensor gating scripts, depot Wi-Fi sync daemon with driver LED signaling).", font_size_pt=9)
                ], space_after=8)
            ])
            populate_cell(p1_cells[2], [
                create_paragraph([create_run("Weeks 1 to 3", font_size_pt=9)], space_after=8)
            ])

            # Row 2 (Phase 2)
            p2_cells = nested_rows[2].findall(f"{W}tc")
            populate_cell(p2_cells[1], [
                create_paragraph([
                    create_run("Convex database design, 20-meter spatial deduplication engine, citizen WhatsApp bot and web reporting interface.", font_size_pt=9)
                ], space_after=8)
            ])
            populate_cell(p2_cells[2], [
                create_paragraph([create_run("Weeks 4 to 6", font_size_pt=9)], space_after=8)
            ])

            # Row 3 (Phase 3)
            p3_cells = nested_rows[3].findall(f"{W}tc")
            populate_cell(p3_cells[1], [
                create_paragraph([
                    create_run("Municipal admin dashboard with council filtering, Stage 2 waste categorization microservice, React Native worker app.", font_size_pt=9)
                ], space_after=8)
            ])
            populate_cell(p3_cells[2], [
                create_paragraph([create_run("Weeks 7 to 9", font_size_pt=9)], space_after=8)
            ])

            # Row 4 (Phase 4)
            p4_cells = nested_rows[4].findall(f"{W}tc")
            populate_cell(p4_cells[1], [
                create_paragraph([
                    create_run("Before-and-after cleanup verification testing, route field trials, performance evaluation, and final project report.", font_size_pt=9)
                ], space_after=8)
            ])
            populate_cell(p4_cells[2], [
                create_paragraph([create_run("Weeks 10 to 12", font_size_pt=9)], space_after=8)
            ])

        # Write output docx
        new_xml = ET.tostring(tree, encoding='utf-8')
        with zipfile.ZipFile(output_path, 'w', compression=zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                if item.filename == 'word/document.xml':
                    zout.writestr(item, new_xml)
                else:
                    zout.writestr(item, zin.read(item.filename))

    print(f"Generated proposal docx: {output_path}")


if __name__ == '__main__':
    template = "docs/Proposal Template.docx"
    output = "docs/CLEO_Project_Proposal.docx"
    build_proposal_docx(template, output)
