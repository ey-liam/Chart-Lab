import os

def guardar_estructura_arbol(ruta_carpeta, archivo_salida):
    # Abrimos el archivo donde se guardará el texto (UTF-8 evita errores con caracteres raros)
    with open(archivo_salida, 'w', encoding='utf-8') as f:
        
        # Obtenemos el nombre de la carpeta principal
        nombre_base = os.path.basename(os.path.abspath(ruta_carpeta))
        
        for root, dirs, files in os.walk(ruta_carpeta):
            # Calculamos la diferencia entre la ruta actual y la original para saber el nivel
            ruta_relativa = os.path.relpath(root, ruta_carpeta)
            
            if ruta_relativa == '.':
                nivel = 0
                f.write(f"{nombre_base}\n")
            else:
                # El nivel define cuántos guiones poner
                nivel = ruta_relativa.count(os.sep) + 1
                indentacion = "- " * nivel
                nombre_carpeta = os.path.basename(root)
                f.write(f"{indentacion}{nombre_carpeta}\n")
            
            # Escribimos los archivos que estén dentro de la carpeta actual
            indentacion_archivos = "- " * (nivel + 1)
            for archivo in files:
                # Opcional: Omitimos que el txt de salida se anote a sí mismo en la lista
                if archivo != os.path.basename(archivo_salida):
                    f.write(f"{indentacion_archivos}{archivo}\n")

# --- CÓMO USARLO ---
# Esto detecta automáticamente la carpeta donde pusiste este script .py
ruta_objetivo = os.path.dirname(os.path.abspath(__file__))

# Indicamos que el archivo estructura.txt se guarde en esa misma carpeta
archivo_txt = os.path.join(ruta_objetivo, "estructura.txt")

# Ejecutamos la función
guardar_estructura_arbol(ruta_objetivo, archivo_txt)

print(f"¡Listo! Se ha creado 'estructura.txt' en la carpeta: {ruta_objetivo}")