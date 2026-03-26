import streamlit as st

# Configuración de la página
st.set_page_config(page_title="Historia - Personajes", layout="wide")

# Estilo personalizado con CSS para las tarjetas
st.markdown("""
    <style>
    .main {
        background-color: #f5f2eb;
    }
    .hero-title {
        font-family: 'Serif';
        font-size: 60px;
        text-align: center;
        color: #2c2c2c;
        margin-bottom: 0px;
    }
    .subtitle {
        text-align: center;
        color: #555;
        font-size: 20px;
        margin-bottom: 40px;
    }
    .card {
        background-color: white;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 2px 2px 10px rgba(0,0,0,0.1);
        text-align: center;
    }
    </style>
    """, unsafe_allow_html=True)

# Encabezado
st.markdown('<h1 class="hero-title">HISTORIA</h1>', unsafe_allow_html=True)
st.markdown('<p class="subtitle">Explorando Figuras Clásicas</p>', unsafe_allow_html=True)

# Datos de los personajes (puedes cambiar las URLs por fotos locales)
personajes = [
    {"nombre": "Sócrates", "desc": "Filósofo griego, padre de la ética occidental.", "img": "https://upload.wikimedia.org/wikipedia/commons/b/bc/Socrates_Louvre.jpg"},
    {"nombre": "Leonardo da Vinci", "desc": "Polímata del Renacimiento, pintor de la Mona Lisa.", "img": "https://upload.wikimedia.org/wikipedia/commons/c/cb/Francesco_Melzi_-_Portrait_of_Leonardo_da_Vinci_-_Google_Art_Project.jpg"},
    {"nombre": "Reina Isabel I", "desc": "Monarca que lideró la edad de oro de Inglaterra.", "img": "https://upload.wikimedia.org/wikipedia/commons/e/af/Queen_Elizabeth_I_by_George_Gower.jpg"},
    {"nombre": "Mahatma Gandhi", "desc": "Líder pacifista de la independencia de la India.", "img": "https://upload.wikimedia.org/wikipedia/commons/7/7a/Mahatma-Gandhi%2C_studio%2C_1931.jpg"}
]

# Crear una cuadrícula de 2x2
cols = st.columns(2)

for i, p in enumerate(personajes):
    with cols[i % 2]:
        st.image(p["img"], use_column_width=True)
        st.subheader(p["nombre"])
        st.write(p["desc"])
        st.markdown("---")

# Pie de página
st.markdown("<br><center>© 2026 Proyecto Historia | Hecho con Python y Streamlit</center>", unsafe_allow_html=True)