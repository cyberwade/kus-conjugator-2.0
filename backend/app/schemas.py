from typing import List

from pydantic import BaseModel


class Category(BaseModel):
    category_id: int
    mood: str
    tense: str
    verb_category: str
    verb_type: str


class VerbCategoryItem(BaseModel):
    verb_category_id: str
    verb_id: int
    category_id: int
    infinitive: str


class Person(BaseModel):
    person_id: int
    label: str


class FormItem(BaseModel):
    person_id: int
    form: str | None


class Verb(BaseModel):
    verb_id: int
    infinitive: str


class VerbCategoryMapItem(BaseModel):
    verb_id: int
    category_id: int


CategoriesResponse = List[Category]
VerbsResponse = List[VerbCategoryItem]
PersonsResponse = List[Person]
FormsResponse = List[FormItem]
AllVerbsResponse = List[Verb]
VerbCategoryMapResponse = List[VerbCategoryMapItem]

