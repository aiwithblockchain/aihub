"""Custom exceptions for clawbot."""

class ClawBotError(Exception):
    """Base error for clawbot."""


class ApiRequestError(ClawBotError):
    """Raised when an HTTP request fails."""


class ParseError(ClawBotError):
    """Raised when a raw API response cannot be parsed."""


class AuthenticationError(ClawBotError):
    """Raised when a login-dependent action is attempted without auth."""


class TaskTimeoutError(ClawBotError):
    """Raised when an async task exceeds the timeout."""


class MediaUploadError(ClawBotError):
    """Raised when media upload fails."""
