from fastapi import APIRouter

from app.schemas import GenericOkResponse

router = APIRouter(tags=["internal"])


@router.post("/_internal/csrf-probe", response_model=GenericOkResponse)
def csrf_probe() -> GenericOkResponse:
    return GenericOkResponse(ok=True)
