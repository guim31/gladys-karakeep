// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`): save a link or a note in Karakeep,
// in a list, with tags — "note: buy batteries" from a voice scene, the link
// of a camera clip, a reminder from another integration.
// -----------------------------------------------------------------------------

const outputs = ({ id, title, existed }) => ({
  bookmark_id: id,
  title,
  already_saved: existed,
});

const common = (fields) => ({
  title: fields.title,
  list: fields.list,
  tags: fields.tags,
  favourite: fields.favourite,
});

export const SCENE_ACTIONS = {
  async save_link(hub, { fields = {} }) {
    return outputs(await hub.save({ type: 'link', content: fields.url, ...common(fields) }));
  },
  async save_note(hub, { fields = {} }) {
    // A note is always new: no "already saved" output.
    const { bookmark_id, title } = outputs(
      await hub.save({ type: 'text', content: fields.text, ...common(fields) }),
    );
    return { bookmark_id, title };
  },
};
