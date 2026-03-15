from typing import List

from fastapi import APIRouter, HTTPException, Query

from app.db import get_db_cursor
from app.schemas import (
    AllVerbsResponse,
    CategoriesResponse,
    Category,
    FormsResponse,
    FormItem,
    PersonsResponse,
    Person,
    Verb,
    VerbCategoryItem,
    VerbCategoryMapItem,
    VerbCategoryMapResponse,
    VerbsResponse,
)


router = APIRouter(prefix="/api", tags=["api"])


@router.get("/categories", response_model=CategoriesResponse)
def get_categories() -> List[Category]:
    """
    Load all categories for building filters.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT category_id, mood, tense, verb_category, verb_type
            FROM public.categories
            ORDER BY category_id
            """
        )
        rows = cur.fetchall()
    return [Category(**row) for row in rows]


@router.get("/verbs", response_model=VerbsResponse)
def get_verbs(categoryIds: str = Query(..., description="Comma-separated list of category_id")) -> List[VerbCategoryItem]:
    """
    Return verbs that have entries in verb_category for given category IDs.
    """
    try:
        category_id_list = [
            int(part.strip())
            for part in categoryIds.split(",")
            if part.strip()
        ]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid categoryIds parameter") from exc

    if not category_id_list:
        return []

    placeholders = ", ".join(["%s"] * len(category_id_list))
    query = f"""
        SELECT
            vc.verb_category_id,
            vc.verb_id,
            vc.category_id,
            v.infinitive
        FROM public.verb_category vc
        JOIN public.verbs v ON v.verb_id = vc.verb_id
        WHERE vc.category_id IN ({placeholders})
        ORDER BY v.infinitive, vc.category_id
    """

    with get_db_cursor() as cur:
        cur.execute(query, category_id_list)
        rows = cur.fetchall()

    return [VerbCategoryItem(**row) for row in rows]


@router.get("/persons", response_model=PersonsResponse)
def get_persons() -> List[Person]:
    """
    Return list of persons for conjugation block.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT person_id, label
            FROM public.persons
            ORDER BY person_id
            """
        )
        rows = cur.fetchall()

    return [Person(**row) for row in rows]


@router.get("/all-verbs", response_model=AllVerbsResponse)
def get_all_verbs() -> List[Verb]:
    """
    Return all verbs sorted alphabetically.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT verb_id, infinitive
            FROM public.verbs
            ORDER BY infinitive
            """
        )
        rows = cur.fetchall()
    return [Verb(**row) for row in rows]


@router.get("/verb-category-map", response_model=VerbCategoryMapResponse)
def get_verb_category_map() -> List[VerbCategoryMapItem]:
    """
    Return all verb-category pairs for cross-filtering on the client.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT verb_id, category_id
            FROM public.verb_category
            ORDER BY verb_id, category_id
            """
        )
        rows = cur.fetchall()
    return [VerbCategoryMapItem(**row) for row in rows]


@router.get("/forms", response_model=FormsResponse)
def get_forms(
    verbId: int = Query(..., description="Verb ID"),
    categoryId: int = Query(..., description="Category ID"),
) -> List[FormItem]:
    """
    Return correct forms for given verb and category.
    """
    with get_db_cursor() as cur:
        cur.execute(
            """
            SELECT person_id, form
            FROM public.forms
            WHERE verb_id = %s AND category_id = %s
            ORDER BY person_id
            """,
            (verbId, categoryId),
        )
        rows = cur.fetchall()

    return [FormItem(**row) for row in rows]

