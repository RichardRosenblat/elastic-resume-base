import io
import logging

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

from app.models.document import ExtractedDocument
from app.utils.exceptions import ExcelGenerationError

logger = logging.getLogger(__name__)

_HEADERS = [
    "Arquivo",
    "Tipo de Documento",
    "Nome",
    "Data",
    "Cônjuge",
    "Número RG",
    "Número CTPS",
    "Data Emissão CTPS",
    "Número PIS",
    "Endereço",
    "Instituição de Ensino",
    "Ano de Conclusão",
    "Texto Extraído",
]

_FIELD_MAP: dict[str, str] = {
    "Nome": "name",
    "Data": "date_of_birth",
    "Cônjuge": "spouse_name",
    "Número RG": "rg_number",
    "Número CTPS": "work_card_number",
    "Data Emissão CTPS": "issue_date",
    "Número PIS": "pis_number",
    "Endereço": "address",
    "Instituição de Ensino": "institution_name",
    "Ano de Conclusão": "year_of_completion",
}

_HEADER_FILL = PatternFill(start_color="4472C4", end_color="4472C4", fill_type="solid")
_HEADER_FONT = Font(bold=True, color="FFFFFF")
_HEADER_ALIGNMENT = Alignment(horizontal="center", vertical="center")


class ExcelService:
    """Service for generating Excel reports from extracted document data."""

    def generate(self, documents: list[ExtractedDocument]) -> bytes:
        """Create an Excel workbook from a list of extracted documents.

        Args:
            documents: List of ExtractedDocument objects to include in the report.

        Returns:
            Raw bytes of the generated .xlsx file.

        Raises:
            ExcelGenerationError: If Excel generation fails.
        """
        try:
            wb = Workbook()
            ws = wb.active
            ws.title = "Documentos"

            # Write styled header row
            for col_idx, header in enumerate(_HEADERS, start=1):
                cell = ws.cell(row=1, column=col_idx, value=header)
                cell.fill = _HEADER_FILL
                cell.font = _HEADER_FONT
                cell.alignment = _HEADER_ALIGNMENT

            # Write data rows
            for row_idx, doc in enumerate(documents, start=2):
                fields = doc.extracted_fields
                row_data = [doc.filename, doc.document_type.value]

                for header in _HEADERS[2:-1]:  # skip Arquivo, Tipo, and Texto Extraído
                    field_key = _FIELD_MAP.get(header)
                    row_data.append(fields.get(field_key, None) if field_key else None)

                row_data.append(doc.raw_text)

                for col_idx, value in enumerate(row_data, start=1):
                    ws.cell(row=row_idx, column=col_idx, value=value)

            # Auto-fit column widths based on header length
            for col_idx, header in enumerate(_HEADERS, start=1):
                col_letter = get_column_letter(col_idx)
                ws.column_dimensions[col_letter].width = max(len(header) + 4, 16)

            buffer = io.BytesIO()
            wb.save(buffer)
            return buffer.getvalue()

        except Exception as exc:
            logger.error("Excel generation failed: %s", exc)
            raise ExcelGenerationError(f"Failed to generate Excel file: {exc}") from exc
