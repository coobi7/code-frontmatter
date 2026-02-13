#---
# intent: "示例文件：展示如何在 Python 文件中使用 Code Frontmatter 表头"
# role: example
# exports:
#   - "fetch_user: 根据 ID 查询用户信息"
#   - "create_user: 创建新用户并返回用户对象"
# depends_on: ["database.py"]
# when_to_load: "需要查看 CFM 表头在 Python 文件中的格式示例时加载"
# mutates_state: true
# ai_notes: "这是一个纯演示文件，不包含任何实际业务逻辑"
#---

from dataclasses import dataclass
from typing import Optional


@dataclass
class User:
    """用户数据模型"""
    id: int
    name: str
    email: str


def fetch_user(user_id: int) -> Optional[User]:
    """根据 ID 查询用户信息"""
    # 模拟数据库查询
    return User(id=user_id, name="示例用户", email="user@example.com")


def create_user(name: str, email: str) -> User:
    """创建新用户并返回用户对象"""
    # 模拟用户创建
    return User(id=1, name=name, email=email)
