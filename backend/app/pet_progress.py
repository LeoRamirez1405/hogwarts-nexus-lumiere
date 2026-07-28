"""Pet lifecycle + sanctuary/user leveling helpers (pure functions).

Kept separate from the routers so the same rules can be reused and unit-tested.
"""
from datetime import datetime

from .config import settings

# 11 named pet care levels (index 0 unused; level is 1..11).
PET_LEVEL_NAMES = [
    "",  # 0 placeholder
    "Cria",
    "Aprendiz",
    "Explorador",
    "Companero Fiel",
    "Guardian",
    "Protector",
    "Centinela Arcano",
    "Vigia Encantado",
    "Bestia Noble",
    "Guardian Ancestral",
    "Leyenda Viviente",
]
MAX_PET_LEVEL = 11
MAX_SANCTUARY_LEVEL = 23


def pet_level_name(level: int) -> str:
    level = max(1, min(MAX_PET_LEVEL, int(level)))
    return PET_LEVEL_NAMES[level]


def pet_age_days(adopted_at: datetime) -> float:
    if not adopted_at:
        return 0.0
    return max(0.0, (datetime.utcnow() - adopted_at).total_seconds() / 86400.0)


def pet_life_fraction(adopted_at: datetime) -> float:
    span = max(1, settings.PET_LIFESPAN_DAYS)
    return pet_age_days(adopted_at) / span


def pet_stage(adopted_at: datetime) -> str:
    f = pet_life_fraction(adopted_at)
    if f < 0.15:
        return "cria"
    if f < 0.45:
        return "joven"
    if f < 0.80:
        return "adulta"
    return "anciana"


def pet_is_expired(adopted_at: datetime) -> bool:
    return pet_life_fraction(adopted_at) >= 1.0


def pet_needs_farewell_warning(adopted_at: datetime) -> bool:
    return pet_life_fraction(adopted_at) >= settings.PET_FAREWELL_WARN_FRACTION


def pet_is_critical(uc) -> bool:
    """Either hunger OR happiness at 0."""
    return uc.hunger == 0 or uc.happiness == 0


def pet_needs_attention_warning(uc) -> bool:
    """Either stat <= 20 and attention_warned is False."""
    return (uc.hunger <= 20 or uc.happiness <= 20) and not uc.attention_warned


def pet_needs_escape_warning(uc) -> bool:
    """Either stat at 0 and escaped_warned is False."""
    return (uc.hunger == 0 or uc.happiness == 0) and not uc.escaped_warned


def pet_should_escape(uc) -> bool:
    """Either stat at 0 for >= PET_ESCAPE_GRACE_HOURS."""
    if uc.last_critical_at is None:
        return False
    if not (uc.hunger == 0 or uc.happiness == 0):
        return False
    hours = (datetime.utcnow() - uc.last_critical_at).total_seconds() / 3600.0
    return hours >= settings.PET_ESCAPE_GRACE_HOURS


def _level_from_score(score: float, max_level: int, base: float) -> int:
    """Highest level whose cumulative (quadratic) threshold is met.

    Threshold for level L = base * L*(L+1)/2, so each level costs a bit more
    than the last. Capped at ``max_level``.
    """
    level = 0
    while level < max_level:
        need = base * (level + 1) * (level + 2) / 2
        if score >= need:
            level += 1
        else:
            break
    return level


def sanctuary_score(pets_count: int, levels_sum: int, items_purchased: int, care_actions: int) -> int:
    return pets_count * 5 + levels_sum + items_purchased + care_actions * 2


def sanctuary_level(score: float) -> int:
    return _level_from_score(score, MAX_SANCTUARY_LEVEL, base=4.0)


def level_progress(score: float, level: int, max_level: int, base: float) -> dict:
    """Progress info toward the next level for UI bars."""
    if level >= max_level:
        return {"current_floor": None, "next_threshold": None, "percent": 100}
    current_floor = base * level * (level + 1) / 2 if level > 0 else 0
    next_threshold = base * (level + 1) * (level + 2) / 2
    span = next_threshold - current_floor
    pct = 0 if span <= 0 else round((score - current_floor) / span * 100)
    return {
        "current_floor": int(current_floor),
        "next_threshold": int(next_threshold),
        "percent": max(0, min(100, pct)),
    }