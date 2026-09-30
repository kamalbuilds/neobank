# Run via: bh-multi run deepsurge "$(cat spikes/grant-selects.py)"
# Airtable's single-select and country pickers ignore synthetic JS clicks, so these
# go through real CDP mouse and key events. Coordinates are measured in the same
# run as the click, because focusing any field scrolls the page.
import time


def center(sel, i):
    js(f"document.querySelectorAll({sel!r})[{i}].scrollIntoView({{block:'center'}})")
    time.sleep(0.7)
    return js(f"(function(){{var b=document.querySelectorAll({sel!r})[{i}].getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}})()")


def options():
    return js("[...document.querySelectorAll('[role=option]')].map(e=>e.textContent.trim())") or []


def pick(label):
    """Click the visible option whose text is exactly `label`."""
    xy = js(f"(function(){{var o=[...document.querySelectorAll('[role=option]')].find(e=>e.textContent.trim()==={label!r});if(!o)return null;o.scrollIntoView({{block:'center'}});var b=o.getBoundingClientRect();return [b.x+b.width/2,b.y+b.height/2]}})()")
    if not xy:
        return f"NO OPTION {label!r}"
    click_at_xy(xy[0], xy[1])
    time.sleep(0.8)
    return f"picked {label}"


def choose(combo_index, label, typed=None):
    xy = center("[role=combobox]", combo_index)
    click_at_xy(xy[0], xy[1])
    time.sleep(1.0)
    if typed:
        type_text(typed)
        time.sleep(1.0)
    seen = options()
    return pick(label) if label in seen else f"combo {combo_index}: {label!r} not in {seen[:12]}"


print(choose(0, "2"))
time.sleep(1)
print(js("document.querySelectorAll('[role=combobox]').length"), "comboboxes after milestone count")
