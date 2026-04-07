"""Search and index management endpoints."""

from __future__ import annotations

from bowltie_py import format_error, format_success
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse
from toolbox_py import get_logger

from app.dependencies import get_search_service
from app.models.search import SearchResponse, SearchResultItem
from app.utils.exceptions import (
    EmbeddingGenerationError,
    FaissIndexError,
    IndexNotReadyError,
)

logger = get_logger(__name__)

router = APIRouter(tags=["Search"])


@router.get(
    "/search",
    response_model=SearchResponse,
    summary="Search resumes by natural language query",
    description=(
        "Accepts a natural language query, generates an embedding using Vertex AI, "
        "and returns ranked resume results from the FAISS index.  PII fields are "
        "decrypted using Cloud KMS if configured."
    ),
)
async def search_resumes(
    q: str = Query(..., description="Natural language search query"),
    limit: int = Query(10, ge=1, le=100, description="Maximum results to return"),
) -> JSONResponse:
    """Search for resumes using a natural language query.

    Args:
        q: Natural language query string.
        limit: Maximum number of results to return (1-100, default 10).

    Returns:
        JSON response with search results.

    Raises:
        HTTPException: If the index is not ready or embedding generation fails.
    """
    logger.info("Search request received", extra={"query": q, "limit": limit})

    try:
        service = get_search_service()

        # Generate query embedding
        query_embedding = service.generate_query_embedding(q)

        # Perform search
        results = service.search(query_embedding, top_k=limit)

        # Fetch metadata for each result
        search_items: list[SearchResultItem] = []
        for resume_id, score in results:
            try:
                metadata = service.get_resume_metadata(resume_id)
                search_items.append(
                    SearchResultItem(
                        resumeId=resume_id,  # Use the alias, not the field name
                        score=score,
                        metadata=metadata,
                    )
                )
            except Exception as exc:
                logger.warning(
                    "Failed to fetch metadata for resume",
                    extra={"resume_id": resume_id, "error": str(exc)},
                )
                # Continue with other results

        response = SearchResponse(
            query=q,
            results=search_items,
            total=len(search_items),
        )

        logger.info(
            "Search completed successfully",
            extra={"results_count": len(search_items)},
        )

        return JSONResponse(
            status_code=200,
            content=format_success(response.model_dump(by_alias=True)),
        )

    except IndexNotReadyError as exc:
        logger.error("Index not ready: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Search index is not ready. Please try again later.",
        )
    except EmbeddingGenerationError as exc:
        logger.error("Failed to generate query embedding: %s", exc)
        raise HTTPException(
            status_code=500,
            detail="Failed to generate query embedding. Please try again.",
        )
    except Exception as exc:
        logger.exception("Unexpected error during search")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during search.",
        )


@router.post(
    "/index/rebuild",
    summary="Rebuild the FAISS index from Firestore",
    description=(
        "Triggers a full rebuild of the FAISS index by fetching all embeddings "
        "from Firestore.  This operation may take several seconds for large "
        "datasets.  The index is optionally persisted to disk after rebuild."
    ),
)
async def rebuild_index() -> JSONResponse:
    """Rebuild the FAISS index from all embeddings in Firestore.

    Returns:
        JSON response indicating success or failure.

    Raises:
        HTTPException: If the rebuild operation fails.
    """
    logger.info("Index rebuild requested")

    try:
        service = get_search_service()
        service.rebuild_index_from_firestore()

        logger.info("Index rebuild completed successfully")

        return JSONResponse(
            status_code=200,
            content=format_success({"status": "rebuilt", "message": "Index rebuilt successfully"}),
        )

    except FaissIndexError as exc:
        logger.error("FAISS index error during rebuild: %s", exc)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to rebuild index: {exc.message}",
        )
    except Exception as exc:
        logger.exception("Unexpected error during index rebuild")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during index rebuild.",
        )
