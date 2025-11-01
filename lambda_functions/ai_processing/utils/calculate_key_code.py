def calculate_key_code(room_number: str) -> str:
    """
    部屋番号からキーボックスのダイヤル4桁コードを計算
    
    ルール: 部屋番号の真ん中の0を67に置き換える
    例: 201 → 2671, 304 → 3674
    
    Args:
        room_number: 部屋番号（例: "201", "304"）
    
    Returns:
        4桁のキーコード（例: "2671", "3674"）
    """
    # 部屋番号が3桁の数字であることを確認
    if not room_number or not room_number.isdigit() or len(room_number) != 3:
        return "0000"  # 無効な部屋番号の場合のデフォルト
    
    # 例: "201" → "2" + "67" + "1" = "2671"
    first_digit = room_number[0]   # 階数
    last_digit = room_number[2]    # 部屋番号
    
    return f"{first_digit}67{last_digit}"