import re
from urllib.parse import urlparse
from rest_framework import serializers


def plain_text(value):
    value = value.strip()
    if re.search(r"<\s*/?\s*[a-zA-Z][^>]*>", value) or any(ord(char) < 32 and char not in "\n\r\t" for char in value):
        raise serializers.ValidationError("Use plain text without HTML or control characters.")
    return value


def text_list(value, maximum=20):
    if not isinstance(value, list) or len(value) > maximum:
        raise serializers.ValidationError(f"Provide a list of up to {maximum} items.")
    result = []
    for item in value:
        if not isinstance(item, str) or not item.strip() or len(item) > 100:
            raise serializers.ValidationError("Each item must contain between 1 and 100 characters.")
        item = plain_text(item)
        if item not in result:
            result.append(item)
    return result


def safe_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or parsed.username is not None or parsed.password is not None:
        raise serializers.ValidationError("Use a valid http or https URL.")
    serializers.URLField(max_length=2000).run_validation(value)
    return value
