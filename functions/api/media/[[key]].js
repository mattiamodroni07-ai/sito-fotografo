export async function onRequestGet({ params, env }) {
  // params.key arriva come array di segmenti del path (es: ['evento-id', 'file.jpg'])
  const fileKey = params.key.join('/');

  const object = await env.MEDIA_BUCKET.get(fileKey);

  if (!object) {
    return new Response('File non trovato', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
}
