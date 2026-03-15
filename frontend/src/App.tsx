import { useEffect, useMemo, useState } from 'react'
import './style.css'

const API_BASE = import.meta.env.VITE_API_BASE || '/api'

type Category = {
  category_id: number
  mood: string
  tense: string
  verb_category: string
  verb_type: string
}

type VerbCategoryItem = {
  verb_category_id: string
  verb_id: number
  category_id: number
  infinitive: string
}

type Person = {
  person_id: number
  label: string
}

type FormItem = {
  person_id: number
  form: string | null
}

type Verb = {
  verb_id: number
  infinitive: string
}

type VerbCategoryMapItem = {
  verb_id: number
  category_id: number
}

type ConjugationResult = {
  isCorrect: boolean
  correctForm: string | null
}

type LevelKey = 'mood' | 'tense' | 'verb_category' | 'verb_type'

type FiltersState = {
  mood: string[]
  tense: string[]
  verb_category: string[]
  verb_type: string[]
}

const emptyFilters: FiltersState = {
  mood: [],
  tense: [],
  verb_category: [],
  verb_type: [],
}

function normalizeValue(value: string | null): string {
  return (value ?? '').trim()
}

function buildContextLabel(category: Category | undefined): React.ReactNode {
  if (!category) return null
  const line1 = [
    normalizeValue(category.mood),
    normalizeValue(category.tense),
  ].filter(Boolean).join(' — ')
  const line2 = [
    normalizeValue(category.verb_category),
    normalizeValue(category.verb_type),
  ].filter(Boolean).join(' — ')
  return (
    <>
      <span className="verb-context-line">{line1}</span>
      <span className="verb-context-line">{line2 || '\u00A0'}</span>
    </>
  )
}

function hasAnySelection(filters: FiltersState): boolean {
  return (
    filters.mood.length > 0 ||
    filters.tense.length > 0 ||
    filters.verb_category.length > 0 ||
    filters.verb_type.length > 0
  )
}

function App() {
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [categoriesError, setCategoriesError] = useState<string | null>(null)

  const [filters, setFilters] = useState<FiltersState>(emptyFilters)

  const [verbs, setVerbs] = useState<VerbCategoryItem[]>([])
  const [verbsLoading, setVerbsLoading] = useState(false)
  const [verbsError, setVerbsError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  const [persons, setPersons] = useState<Person[]>([])
  const [personsLoading, setPersonsLoading] = useState(false)
  const [personsError, setPersonsError] = useState<string | null>(null)

  const [allVerbs, setAllVerbs] = useState<Verb[]>([])
  const [verbCategoryMap, setVerbCategoryMap] = useState<VerbCategoryMapItem[]>([])
  const [selectedVerbIds, setSelectedVerbIds] = useState<number[]>([])
  const [verbFilterOpen, setVerbFilterOpen] = useState(false)

  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({})
  const [results, setResults] = useState<Record<number, ConjugationResult>>({})
  const [checking, setChecking] = useState(false)
  const [formsError, setFormsError] = useState<string | null>(null)

  // Map category_id -> Category for quick lookup
  const categoriesById = useMemo(() => {
    const map: Record<number, Category> = {}
    for (const c of categories) {
      map[c.category_id] = c
    }
    return map
  }, [categories])

  // Verb <-> Category mappings for cross-filtering
  const verbToCategories = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const item of verbCategoryMap) {
      if (!map.has(item.verb_id)) map.set(item.verb_id, new Set())
      map.get(item.verb_id)!.add(item.category_id)
    }
    return map
  }, [verbCategoryMap])

  const categoryToVerbs = useMemo(() => {
    const map = new Map<number, Set<number>>()
    for (const item of verbCategoryMap) {
      if (!map.has(item.category_id)) map.set(item.category_id, new Set())
      map.get(item.category_id)!.add(item.verb_id)
    }
    return map
  }, [verbCategoryMap])

  // Unique normalized values per level
  const levelValues = useMemo(() => {
    const values: Record<LevelKey, string[]> = {
      mood: [],
      tense: [],
      verb_category: [],
      verb_type: [],
    }
    const sets: Record<LevelKey, Set<string>> = {
      mood: new Set(),
      tense: new Set(),
      verb_category: new Set(),
      verb_type: new Set(),
    }
    for (const c of categories) {
      (['mood', 'tense', 'verb_category', 'verb_type'] as LevelKey[]).forEach((key) => {
        const v = normalizeValue(c[key])
        if (v && !sets[key].has(v)) {
          sets[key].add(v)
          values[key].push(v)
        }
      })
    }
    (Object.keys(values) as LevelKey[]).forEach((key) => {
      values[key].sort((a, b) => a.localeCompare(b, 'es'))
    })
    // Custom order: verb_category — Regular first; verb_type — AR, ER, IR first
    const prioritySort = (arr: string[], first: string[]) => {
      const top = first.filter((v) => arr.includes(v))
      const rest = arr.filter((v) => !first.includes(v))
      return [...top, ...rest]
    }
    values.verb_category = prioritySort(values.verb_category, ['Regular', 'Irregular'])
    values.verb_type = prioritySort(values.verb_type, ['AR', 'ER', 'IR'])
    return values
  }, [categories])

  // Categories that satisfy current category-level filters (without verb filter)
  const filteredCategoriesBase = useMemo(() => {
    return categories.filter((c) => {
      const checks: [LevelKey, string[]][] = [
        ['mood', filters.mood],
        ['tense', filters.tense],
        ['verb_category', filters.verb_category],
        ['verb_type', filters.verb_type],
      ]
      return checks.every(([key, selected]) => {
        if (selected.length === 0) return true
        const v = normalizeValue(c[key])
        return selected.includes(v)
      })
    })
  }, [categories, filters])

  // Final filtered categories: also account for selected verbs
  const filteredCategories = useMemo(() => {
    if (selectedVerbIds.length === 0) return filteredCategoriesBase
    const selectedVerbSet = new Set(selectedVerbIds)
    return filteredCategoriesBase.filter((c) => {
      const verbsInCat = categoryToVerbs.get(c.category_id)
      if (!verbsInCat) return false
      return [...verbsInCat].some((vid) => selectedVerbSet.has(vid))
    })
  }, [filteredCategoriesBase, selectedVerbIds, categoryToVerbs])

  // Disabled states for filter values according to cross-filter rules (including verb filter)
  const disabledValues = useMemo(() => {
    const disabled: Record<LevelKey, Set<string>> = {
      mood: new Set(),
      tense: new Set(),
      verb_category: new Set(),
      verb_type: new Set(),
    };

    const selectedVerbSet = new Set(selectedVerbIds);

    (['mood', 'tense', 'verb_category', 'verb_type'] as LevelKey[]).forEach((level) => {
      const otherLevels = (['mood', 'tense', 'verb_category', 'verb_type'] as LevelKey[]).filter(
        (l) => l !== level,
      )

      for (const value of levelValues[level]) {
        const hasAny = categories.some((c) => {
          const v = normalizeValue(c[level])
          if (v !== value) return false
          // must satisfy selections on other levels
          const matchesOtherLevels = otherLevels.every((l) => {
            const selected = filters[l]
            if (selected.length === 0) return true
            const cv = normalizeValue(c[l])
            return selected.includes(cv)
          })
          if (!matchesOtherLevels) return false
          // must have at least one selected verb (if any verbs selected)
          if (selectedVerbSet.size > 0) {
            const verbsInCat = categoryToVerbs.get(c.category_id)
            if (!verbsInCat) return false
            return [...verbsInCat].some((vid) => selectedVerbSet.has(vid))
          }
          return true
        })
        if (!hasAny) {
          disabled[level].add(value)
        }
      }
    })

    return disabled
  }, [categories, filters, levelValues, selectedVerbIds, categoryToVerbs])

  // Disabled verb IDs: verbs that have no categories in filteredCategoriesBase
  const disabledVerbIds = useMemo(() => {
    const disabled = new Set<number>()
    if (!hasAnySelection(filters)) return disabled
    const baseCatIds = new Set(filteredCategoriesBase.map((c) => c.category_id))
    for (const verb of allVerbs) {
      const cats = verbToCategories.get(verb.verb_id)
      if (!cats || ![...cats].some((cid) => baseCatIds.has(cid))) {
        disabled.add(verb.verb_id)
      }
    }
    return disabled
  }, [allVerbs, filteredCategoriesBase, verbToCategories, filters])

  const hasAnyAnswer = useMemo(
    () => Object.values(userAnswers).some((v) => v.trim().length > 0),
    [userAnswers],
  )

  const currentVerb = verbs[currentIndex]
  const currentCategory = currentVerb ? categoriesById[currentVerb.category_id] : undefined

  // Load categories
  useEffect(() => {
    const load = async () => {
      setCategoriesLoading(true)
      setCategoriesError(null)
      try {
        const res = await fetch(`${API_BASE}/categories`)
        if (!res.ok) {
          throw new Error('Не удалось загрузить категории')
        }
        const data: Category[] = await res.json()
        setCategories(data)
      } catch (e: any) {
        setCategoriesError(e.message || 'Ошибка при загрузке категорий')
      } finally {
        setCategoriesLoading(false)
      }
    }
    load()
  }, [])

  // Load all verbs for the verb filter
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/all-verbs`)
        if (!res.ok) throw new Error('Не удалось загрузить глаголы')
        const data: Verb[] = await res.json()
        setAllVerbs(data)
      } catch {
        // silently fail — verb filter just won't have data
      }
    }
    load()
  }, [])

  // Load verb-category mapping for cross-filtering
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/verb-category-map`)
        if (!res.ok) throw new Error('Не удалось загрузить маппинг')
        const data: VerbCategoryMapItem[] = await res.json()
        setVerbCategoryMap(data)
      } catch {
        // silently fail
      }
    }
    load()
  }, [])

  // Load persons once
  useEffect(() => {
    const load = async () => {
      setPersonsLoading(true)
      setPersonsError(null)
      try {
        const res = await fetch(`${API_BASE}/persons`)
        if (!res.ok) {
          throw new Error('Не удалось загрузить лица')
        }
        const data: Person[] = await res.json()
        setPersons(data)
      } catch (e: any) {
        setPersonsError(e.message || 'Ошибка при загрузке лиц')
      } finally {
        setPersonsLoading(false)
      }
    }
    load()
  }, [])

  // Reload verbs when filters change
  useEffect(() => {
    // Reset conjugation block when verb list changes
    setUserAnswers({})
    setResults({})
    setFormsError(null)

    if (!hasAnySelection(filters) && selectedVerbIds.length === 0) {
      setVerbs([])
      setCurrentIndex(0)
      return
    }

    const categoryIds = filteredCategories.map((c) => c.category_id)
    if (categoryIds.length === 0) {
      setVerbs([])
      setCurrentIndex(0)
      return
    }

    const load = async () => {
      setVerbsLoading(true)
      setVerbsError(null)
      try {
        const param = categoryIds.join(',')
        const res = await fetch(`${API_BASE}/verbs?categoryIds=${encodeURIComponent(param)}`)
        if (!res.ok) {
          throw new Error('Не удалось загрузить глаголы')
        }
        let data: VerbCategoryItem[] = await res.json()
        // Filter by selected verbs if any
        if (selectedVerbIds.length > 0) {
          const selectedSet = new Set(selectedVerbIds)
          data = data.filter((v) => selectedSet.has(v.verb_id))
        }
        setVerbs(data)
        setCurrentIndex(0)
      } catch (e: any) {
        setVerbsError(e.message || 'Ошибка при загрузке глаголов')
        setVerbs([])
        setCurrentIndex(0)
      } finally {
        setVerbsLoading(false)
      }
    }

    load()
  }, [filters, filteredCategories, selectedVerbIds])

  const toggleFilter = (level: LevelKey, value: string) => {
    setFilters((prev) => {
      const selected = prev[level]
      const exists = selected.includes(value)
      const nextLevelValues = exists
        ? selected.filter((v) => v !== value)
        : [...selected, value]
      return {
        ...prev,
        [level]: nextLevelValues,
      }
    })
  }

  const toggleVerbId = (verbId: number) => {
    setSelectedVerbIds((prev) =>
      prev.includes(verbId) ? prev.filter((id) => id !== verbId) : [...prev, verbId],
    )
  }

  const resetConjugation = () => {
    setUserAnswers({})
    setResults({})
    setFormsError(null)
  }

  const goToPreviousVerb = () => {
    if (currentIndex > 0) {
      setCurrentIndex((idx) => idx - 1)
      resetConjugation()
    }
  }

  const goToNextVerb = () => {
    if (currentIndex < verbs.length - 1) {
      setCurrentIndex((idx) => idx + 1)
      resetConjugation()
    }
  }

  const handleAnswerChange = (personId: number, value: string) => {
    setUserAnswers((prev) => ({
      ...prev,
      [personId]: value,
    }))
  }

  const handleCheck = async () => {
    if (!currentVerb || !currentCategory) return

    setChecking(true)
    setFormsError(null)
    try {
      const url = `${API_BASE}/forms?verbId=${currentVerb.verb_id}&categoryId=${currentVerb.category_id}`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error('Не удалось загрузить формы спряжения')
      }
      const data: FormItem[] = await res.json()
      const correctByPerson: Record<number, string | null> = {}
      data.forEach((f) => {
        correctByPerson[f.person_id] = f.form
      })

      const newResults: Record<number, ConjugationResult> = {}
      for (const person of persons) {
        const userValue = (userAnswers[person.person_id] ?? '').trim().toLowerCase()
        const correctRaw = correctByPerson[person.person_id]
        const correctNorm = (correctRaw ?? '').trim().toLowerCase()

        // If correct form is null/empty: empty input, space, or dash = correct; anything else = incorrect
        if (!correctNorm) {
          const emptyAnswer = !userValue || userValue === '–' || userValue === '-'
          if (emptyAnswer) {
            newResults[person.person_id] = {
              isCorrect: true,
              correctForm: null,
            }
            continue
          }
          newResults[person.person_id] = {
            isCorrect: false,
            correctForm: null,
          }
          continue
        }

        if (!userValue) {
          newResults[person.person_id] = {
            isCorrect: false,
            correctForm: correctRaw ?? null,
          }
          continue
        }

        const isCorrect = userValue === correctNorm
        newResults[person.person_id] = {
          isCorrect,
          correctForm: correctRaw ?? null,
        }
      }
      setResults(newResults)
    } catch (e: any) {
      setFormsError(e.message || 'Ошибка при проверке спряжения')
      setResults({})
    } finally {
      setChecking(false)
    }
  }

  const totalChecked = useMemo(() => Object.keys(results).length, [results])
  const totalCorrect = useMemo(
    () => Object.values(results).filter((r) => r.isCorrect).length,
    [results],
  )

  const conjugationReadOnly = totalChecked > 0

  const renderFiltersForLevel = (key: LevelKey, title: string) => {
    return (
      <div className="card-section">
        <h3>{title}</h3>
        {categoriesLoading && <p className="muted">Загрузка фильтров…</p>}
        {categoriesError && <p className="error-text">{categoriesError}</p>}
        <div className="filters-row">
          {levelValues[key].map((value) => {
            const selected = filters[key].includes(value)
            const disabled = disabledValues[key].has(value)
            const classNames = [
              'filter-button',
              selected ? 'filter-button--active' : '',
              disabled ? 'filter-button--disabled' : '',
            ]
              .join(' ')
              .trim()
            return (
              <button
                key={value}
                type="button"
                className={classNames}
                onClick={() => !disabled && toggleFilter(key, value)}
                disabled={disabled}
                title={
                  disabled
                    ? 'Нет глаголов с этим значением при текущих фильтрах'
                    : undefined
                }
              >
                {value}
              </button>
            )
          })}
          {levelValues[key].length === 0 && !categoriesLoading && (
            <p className="muted">Нет данных для этого уровня</p>
          )}
        </div>
      </div>
    )
  }

  let verbsStatusText: string | null = null
  if (verbsLoading) {
    verbsStatusText = 'Загрузка глаголов…'
  } else if (!currentVerb) {
    if (hasAnySelection(filters) || selectedVerbIds.length > 0) {
      verbsStatusText = 'Нет глаголов по выбранным фильтрам'
    } else {
      verbsStatusText = 'Выберите фильтры для начала тренировки'
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>Kus Conjugator 2.0</h1>
      </header>

      <main className="layout">
        <section className="card card--filters">
          <div className="filters-list">
            {renderFiltersForLevel('mood', 'Наклонение')}
            {renderFiltersForLevel('tense', 'Время')}
            {renderFiltersForLevel('verb_category', 'Категория глагола')}
            {renderFiltersForLevel('verb_type', 'Тип глагола')}

            {/* Verb filter — collapsible */}
            <div className="card-section">
              <h3
                className="verb-filter-toggle"
                onClick={() => setVerbFilterOpen((prev) => !prev)}
              >
                Глагол
                <span className={`toggle-arrow ${verbFilterOpen ? 'toggle-arrow--open' : ''}`}>
                  ▸
                </span>
                <span className={`verb-filter-count ${selectedVerbIds.length === 0 ? 'verb-filter-count--hidden' : ''}`}>
                  {selectedVerbIds.length || 0}
                  <button
                    type="button"
                    className="verb-filter-clear"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedVerbIds([])
                    }}
                    title="Сбросить выбранные глаголы"
                  >
                    ✕
                  </button>
                </span>
              </h3>
              {verbFilterOpen && (
                <div className="verb-filter-grid">
                  {allVerbs.map((verb) => {
                    const selected = selectedVerbIds.includes(verb.verb_id)
                    const disabled = disabledVerbIds.has(verb.verb_id)
                    const classNames = [
                      'filter-button',
                      selected ? 'filter-button--active' : '',
                      disabled ? 'filter-button--disabled' : '',
                    ]
                      .join(' ')
                      .trim()
                    return (
                      <button
                        key={verb.verb_id}
                        type="button"
                        className={classNames}
                        onClick={() => !disabled && toggleVerbId(verb.verb_id)}
                        disabled={disabled}
                        title={
                          disabled
                            ? 'Нет категорий для этого глагола при текущих фильтрах'
                            : undefined
                        }
                      >
                        {verb.infinitive}
                      </button>
                    )
                  })}
                  {allVerbs.length === 0 && (
                    <p className="muted">Загрузка глаголов…</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="card card--verb">
          {verbsError && <p className="error-text">{verbsError}</p>}
          {verbsStatusText && <p className="muted" style={{ textAlign: 'center' }}>{verbsStatusText}</p>}

          {currentVerb && currentCategory && (
            <div className="verb-block">
              <div className="verb-nav">
                <button
                  type="button"
                  onClick={goToPreviousVerb}
                  disabled={currentIndex === 0}
                  className="nav-button"
                >
                  ← Предыдущий
                </button>
                <div className="verb-counter">
                  {currentIndex + 1} из {verbs.length}
                </div>
                <button
                  type="button"
                  onClick={goToNextVerb}
                  disabled={currentIndex >= verbs.length - 1}
                  className="nav-button"
                >
                  Следующий →
                </button>
              </div>
              <div className="verb-context">{buildContextLabel(currentCategory)}</div>
              <h3 className="verb-infinitive">{currentVerb.infinitive}</h3>
            </div>
          )}
        </section>

        <section className="card">
          {personsError && <p className="error-text">{personsError}</p>}
          {formsError && <p className="error-text">{formsError}</p>}
          {personsLoading && <p className="muted">Загрузка лиц…</p>}

          {!currentVerb && (
            <p className="muted" style={{ textAlign: 'center' }}>
              Для начала выберите фильтры и дождитесь появления списка глаголов.
            </p>
          )}

          {currentVerb && persons.length > 0 && (
            <>
              <div className="conjugation-grid">
                {persons.map((person) => {
                  const value = userAnswers[person.person_id] ?? ''
                  const result = results[person.person_id]

                  const classes = ['conjugation-input']
                  if (result) {
                    classes.push(
                      result.isCorrect
                        ? 'conjugation-input--correct'
                        : 'conjugation-input--incorrect',
                    )
                  }

                  return (
                    <div key={person.person_id} className="conjugation-row">
                      <div className="conjugation-label-row">
                        <label className="conjugation-label" htmlFor={`p-${person.person_id}`}>
                          {person.label}
                        </label>
                        <div className={`conjugation-hint ${result && !result.isCorrect ? 'conjugation-hint--visible' : ''}`}>
                          {result && !result.isCorrect ? (result.correctForm ?? '–') : '\u00A0'}
                        </div>
                      </div>
                      <input
                        id={`p-${person.person_id}`}
                        type="text"
                        className={classes.join(' ')}
                        placeholder="Введите спряжение…"
                        value={value}
                        onChange={(e) => handleAnswerChange(person.person_id, e.target.value)}
                        readOnly={conjugationReadOnly}
                      />
                    </div>
                  )
                })}
              </div>

              <div className="conjugation-actions">
                <button
                  type="button"
                  className="nav-arrow"
                  onClick={goToPreviousVerb}
                  disabled={currentIndex === 0}
                  title="Предыдущий глагол"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={handleCheck}
                  disabled={checking || !currentVerb}
                >
                  Проверить
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={resetConjugation}
                  disabled={false}
                >
                  Повторить
                </button>
                <button
                  type="button"
                  className="nav-arrow"
                  onClick={goToNextVerb}
                  disabled={currentIndex >= verbs.length - 1}
                  title="Следующий глагол"
                >
                  →
                </button>
              </div>
              <div className={`summary ${totalChecked > 0 ? '' : 'summary--hidden'}`}>
                Результат: {totalCorrect} из {totalChecked || persons.length}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App

