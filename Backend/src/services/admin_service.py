from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from src.models.user_model import User, UserRole
from sqlalchemy import text

def delete_user_by_id(user_id: UUID, current_user: User, db: Session):
    # בדיקת הרשאות
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="❌ You do not have permission to perform this action"
        )

    # מניעת מחיקת עצמו
    if str(user_id) == str(current_user.employee_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="⚠️ You cannot delete yourself"
        )

    # בדיקה אם המשתמש קיים
    user_to_delete = db.query(User).filter(User.employee_id == user_id).first()
    if not user_to_delete:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="❌ User not found"
        )

    try:
        # הגדרת user_id עבור הלוגים אם יש טריגר audit
        db.execute(
            text("SET session.audit.user_id = :user_id"),
            {"user_id": str(current_user.employee_id)}
        )

        # שליפת כל טבלאות ועמודות עם FK ל-users.employee_id או users.user_id
        fk_query = text("""
            SELECT
                tc.table_schema,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM 
                information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu
                  ON tc.constraint_name = kcu.constraint_name
                  AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage AS ccu
                  ON ccu.constraint_name = tc.constraint_name
                  AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND ccu.table_name = 'users'
              AND ccu.column_name IN ('employee_id', 'user_id')
        """)

        fk_rows = db.execute(fk_query).fetchall()

        # קיבוץ לפי טבלה
        from collections import defaultdict
        table_columns = defaultdict(list)  # {table_name: [columns]}
        for row in fk_rows:
            # row: (schema, table_name, column_name, foreign_table_name, foreign_column_name)
            table_columns[row.table_name].append(row.column_name)

        # טיפול בטבלאות עם FK: עדכון או מחיקה
        # נניח שבטבלאות שבהן העמודה יכולה להיות NULL נעשה UPDATE ל-NULL
        # בטבלאות אחרות נעשה DELETE
        # נוכל לבדוק אם העמודה מאפשרת NULL ב-information_schema.columns
        for table_name, columns in table_columns.items():
            # בדיקה אילו עמודות מאפשרות NULL
            nullable_query = text("""
                SELECT column_name, is_nullable
                FROM information_schema.columns
                WHERE table_name = :table_name
                  AND column_name = ANY(:columns)
            """)
            result = db.execute(nullable_query, {"table_name": table_name, "columns": columns}).fetchall()
            nullable_columns = {r.column_name: r.is_nullable == 'YES' for r in result}

            # עדכון ל-NULL או מחיקה בהתאם
            for col in columns:
                if nullable_columns.get(col, False):
                    # מאפשר NULL — עדכון לשים NULL
                    update_sql = f"UPDATE {table_name} SET {col} = NULL WHERE {col} = :user_id"
                    db.execute(text(update_sql), {"user_id": str(user_id)})
                else:
                    # לא מאפשר NULL — מחיקה
                    delete_sql = f"DELETE FROM {table_name} WHERE {col} = :user_id"
                    db.execute(text(delete_sql), {"user_id": str(user_id)})

        # לאחר שחרור כל ההקשרים - מחיקת המשתמש עצמו
        db.delete(user_to_delete)
        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Internal Server Error: {str(e)}"
        )

    finally:
        # איפוס ה-session audit
        db.execute(text("SET session.audit.user_id = DEFAULT"))

    return {
        "message": "✅ User deleted successfully",
        "user_id": str(user_id)
    }
