import { supabase } from '../config/supabase';
import { ESTADO_COMBATE } from '../constants/estados';

export class ComunidadService {
  /**
   * Obtiene el Leaderboard: Top 10 usuarios ordenados por su nivel y puntaje promedio de sus prácticas.
   */
  async getLeaderboard() {
    // Para simplificar, obtenemos todos los usuarios (en un entorno real usaríamos paginación)
    // Luego calculamos el puntaje promedio de sus prácticas
    const { data: usuarios, error } = await supabase
      .from('tbl_usuario')
      .select(`
        id,
        nombre,
        apellido,
        tbl_nivel:id_nivel (
          nombre
        )
      `)
      .eq('id_rol', 1);

    if (error) throw new Error(error.message);

    const { data: practicas, error: errorPracticas } = await supabase
      .from('tbl_practica')
      .select('id_usuario, puntaje')
      .eq('id_estado', 5);

    if (errorPracticas) throw new Error(errorPracticas.message);

    const leaderboard = usuarios.map((user: any) => {
      const practicasUser = practicas.filter((p: any) => p.id_usuario === user.id);
      const totalPuntaje = practicasUser.reduce((acc: number, curr: any) => acc + (curr.puntaje || 0), 0);
      const promedio = practicasUser.length > 0 ? (totalPuntaje / practicasUser.length) : 0;

      return {
        id: user.id,
        nombre: `${user.nombre} ${user.apellido}`,
        nivel: (user.tbl_nivel as any)?.nombre || 'Sin nivel',
        puntajePromedio: Math.round(promedio),
        totalPracticas: practicasUser.length
      };
    });

    // Ordenar de mayor a menor puntaje y tomar el Top 10
    leaderboard.sort((a, b) => b.puntajePromedio - a.puntajePromedio);
    return leaderboard.slice(0, 10);
  }

  /**
   * Obtiene el Feed mixto: combates y prácticas recientes
   */
  async getFeed() {
    const { data: combates, error } = await supabase
      .from('tbl_combate')
      .select(`
        id,
        id_estado,
        fecha,
        jugador1:tbl_usuario!id_usuario_jugador1(id, nombre, apellido),
        jugador2:tbl_usuario!id_usuario_jugador2(id, nombre, apellido),
        ganador:tbl_usuario!id_usuario_ganador(id, nombre, apellido)
      `)
      .in('id_estado', [ESTADO_COMBATE.EN_CURSO, ESTADO_COMBATE.FINALIZADO])
      .order('fecha', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    const feedCombates = combates.map((c: any) => {
      const nombreJ1 = c.jugador1 ? `${c.jugador1.nombre} ${c.jugador1.apellido}` : 'Alguien';
      const nombreJ2 = c.jugador2 ? `${c.jugador2.nombre} ${c.jugador2.apellido}` : 'Alguien';

      let mensaje = '';
      if (c.id_estado === ESTADO_COMBATE.FINALIZADO && c.ganador) {
        const nombreGanador = `${c.ganador.nombre} ${c.ganador.apellido}`;
        const nombrePerdedor = c.ganador.id === c.jugador1?.id ? nombreJ2 : nombreJ1;
        mensaje = `${nombreGanador} venció a ${nombrePerdedor} 🏆`;
      } else if (c.id_estado === ESTADO_COMBATE.FINALIZADO && !c.ganador) {
        mensaje = `${nombreJ1} y ${nombreJ2} empataron su combate 🤝`;
      } else {
        mensaje = `${nombreJ1} está combatiendo contra ${nombreJ2} ⚔️`;
      }

      return {
        id: c.id,
        fecha: c.fecha,
        tipo: 'combate' as const,
        mensaje,
        jugador1Inicial: c.jugador1?.nombre?.charAt(0).toUpperCase() ?? '?',
        jugador2Inicial: c.jugador2?.nombre?.charAt(0).toUpperCase() ?? '?',
        estado: c.id_estado === ESTADO_COMBATE.FINALIZADO ? 'FINALIZADO' : 'EN_CURSO'
      };
    });

    // Prácticas recientes con puntaje destacado
    const { data: practicas } = await supabase
      .from('tbl_practica')
      .select(`
        id,
        puntaje,
        fecha,
        usuario:tbl_usuario!id_usuario(nombre, apellido),
        cancion:tbl_cancion!id_cancion(titulo)
      `)
      .eq('id_estado', 5)
      .not('puntaje', 'is', null)
      .order('fecha', { ascending: false })
      .limit(15);

    const feedPracticas = (practicas ?? []).map((p: any) => {
      const nombreUsuario = p.usuario ? `${p.usuario.nombre} ${p.usuario.apellido}` : 'Alguien';
      const tituloCancion = p.cancion?.titulo ?? 'una canción';
      return {
        id: `practica-${p.id}`,
        fecha: p.fecha,
        tipo: 'practica' as const,
        mensaje: `${nombreUsuario} practicó "${tituloCancion}" y obtuvo ${p.puntaje} pts 🎤`,
        jugador1Inicial: p.usuario?.nombre?.charAt(0).toUpperCase() ?? '?',
        jugador2Inicial: '',
        puntaje: p.puntaje,
        estado: 'PRACTICA'
      };
    });

    // Mezclar combates + prácticas ordenados por fecha descendente
    const feedCompleto = [...feedCombates, ...feedPracticas]
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 20);

    return feedCompleto;
  }

  /**
   * Obtiene el Top de Canciones más usadas
   */
  async getTopCanciones() {
    const { data: practicas, error: errorPracticas } = await supabase
      .from('tbl_practica')
      .select('id_cancion')
      .eq('id_estado', 5);
    
    if (errorPracticas) throw new Error(errorPracticas.message);

    const conCount = practicas.reduce((acc: any, curr: any) => {
      if (!acc[curr.id_cancion]) {
        acc[curr.id_cancion] = 0;
      }
      acc[curr.id_cancion]++;
      return acc;
    }, {});

    const topIds = Object.keys(conCount)
      .sort((a, b) => conCount[b] - conCount[a])
      .slice(0, 5);

    if (topIds.length === 0) return [];

    const { data: canciones, error } = await supabase
      .from('tbl_cancion')
      .select('id, titulo, tbl_artista_x_cancion(tbl_artista(nombre))')
      .in('id', topIds);
      
    if (error) throw new Error(error.message);

    return canciones.map((c: any) => {
      const artistas = c.tbl_artista_x_cancion?.map((axc: any) => axc.tbl_artista?.nombre).join(', ') || 'Desconocido';
      return {
        id: c.id,
        titulo: c.titulo,
        artista: artistas,
        vecesCantada: conCount[c.id] || 0
      };
    }).sort((a, b) => b.vecesCantada - a.vecesCantada);
  }

  /**
   * Obtiene el perfil de un usuario específico y sus estadísticas
   */
  async getPerfil(idUsuario: string) {
    const { data: user, error } = await supabase
      .from('tbl_usuario')
      .select(`
        id,
        nombre,
        apellido,
        tbl_nivel:id_nivel (
          nombre
        )
      `)
      .eq('id', idUsuario)
      .single();

    if (error) throw new Error(error.message);

    const { data: practicas, error: errorPracticas } = await supabase
      .from('tbl_practica')
      .select('id_cancion, puntaje, fecha')
      .eq('id_usuario', idUsuario)
      .eq('id_estado', 5);

    if (errorPracticas) throw new Error(errorPracticas.message);

    const { data: combates, error: errorCombates } = await supabase
      .from('tbl_combate')
      .select('id_usuario_ganador')
      .or(`id_usuario_jugador1.eq.${idUsuario},id_usuario_jugador2.eq.${idUsuario}`)
      .eq('id_estado', ESTADO_COMBATE.FINALIZADO);

    if (errorCombates) throw new Error(errorCombates.message);

    // Calcular estadísticas básicas
    let mejorPuntaje = 0;
    let sumaPuntaje = 0;
    const conteoCancion: Record<number, number> = {};

    practicas.forEach((p: any) => {
      if (p.puntaje > mejorPuntaje) mejorPuntaje = p.puntaje;
      sumaPuntaje += (p.puntaje || 0);
      if (p.id_cancion) {
        conteoCancion[p.id_cancion] = (conteoCancion[p.id_cancion] || 0) + 1;
      }
    });

    const combatesGanados = combates.filter((c: any) => c.id_usuario_ganador == idUsuario).length;
    const winRate = combates.length > 0 ? Math.round((combatesGanados / combates.length) * 100) : 0;

    // Canción favorita (la más practicada)
    let cancionFavorita: string | null = null;
    const idsFavoritos = Object.entries(conteoCancion).sort((a, b) => b[1] - a[1]);
    if (idsFavoritos.length > 0) {
      const idFav = Number(idsFavoritos[0][0]);
      const { data: canFav } = await supabase
        .from('tbl_cancion')
        .select('titulo')
        .eq('id', idFav)
        .single();
      cancionFavorita = canFav?.titulo ?? null;
    }

    // Historial reciente — últimas 5 prácticas con título de canción
    const recientes = [...practicas]
      .sort((a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
      .slice(0, 5);

    const idsRecientes = [...new Set(recientes.map((p: any) => p.id_cancion))];
    const { data: cancionesRecientes } = await supabase
      .from('tbl_cancion')
      .select('id, titulo')
      .in('id', idsRecientes);

    const mapaCanciones: Record<number, string> = {};
    (cancionesRecientes ?? []).forEach((c: any) => { mapaCanciones[c.id] = c.titulo; });

    const historialReciente = recientes.map((p: any) => ({
      fecha: p.fecha,
      puntaje: p.puntaje,
      cancionTitulo: mapaCanciones[p.id_cancion] ?? 'Canción desconocida'
    }));

    return {
      id: user.id,
      nombre: `${user.nombre} ${user.apellido}`,
      nivel: (user.tbl_nivel as any)?.nombre || 'Sin nivel',
      estadisticas: {
        totalPracticas: practicas.length,
        puntajePromedio: practicas.length > 0 ? Math.round(sumaPuntaje / practicas.length) : 0,
        mejorPuntaje,
        combatesJugados: combates.length,
        combatesGanados,
        winRate
      },
      cancionFavorita,
      historialReciente
    };
  }
}
