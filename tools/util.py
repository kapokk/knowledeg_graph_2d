def copy_object_exclude(obj, exclude_properties):
    """
    复制一个对象的所有属性，除了指定的属性。

    :param obj: 要复制的对象
    :param exclude_properties: 要排除的属性列表
    :return: 包含复制属性的新对象
    """
    # 使用 vars() 获取对象的 __dict__，然后使用字典推导式排除指定的属性
    new_obj_dict = {k: v for k, v in vars(obj).items() if k not in exclude_properties}

    # 假设新对象和原对象是相同类型，这里创建一个新对象
    # 如果不同类型，需要根据实际情况创建
    new_obj = type(obj)()
    new_obj.__dict__.update(new_obj_dict)
    return new_obj