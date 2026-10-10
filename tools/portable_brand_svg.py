"""Flatten nested SVG viewports and polygon clips without redesigning artwork.

Requires Shapely for exact polygon intersections. The result uses ordinary
groups, transforms and painted paths, which also work in simple PDF importers.
"""
import copy
import re
import xml.etree.ElementTree as ET
from pathlib import Path
from shapely.geometry import Polygon

NS='http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
def tag(name): return '{'+NS+'}'+name


def polygons(path):
    tokens=re.findall(r'[A-Za-z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?',path)
    result=[];i=0;points=[]
    while i<len(tokens):
        command=tokens[i];i+=1
        if command in ('M','L'):
            points.append((float(tokens[i]),float(tokens[i+1])));i+=2
        elif command=='Z':
            if len(points)>=3:
                poly=Polygon(points)
                if not poly.is_valid:poly=poly.buffer(0)
                if poly.area>1e-10:result.append(poly)
            points=[]
        else:raise ValueError('Expected straight polygon path, got '+command)
    assert not points,'Unclosed polygon'
    return result


def geometry(path,evenodd=False):
    parts=polygons(path)
    assert parts
    result=parts[0]
    for part in parts[1:]:
        result=result.symmetric_difference(part)if evenodd else result.union(part)
    return result


def path_data(shape):
    def ring(coords):
        points=list(coords)[:-1]
        return 'M '+' L '.join(f'{x:.10f} {y:.10f}'for x,y in points)+' Z'
    if shape.is_empty:return ''
    if shape.geom_type=='Polygon':
        return ' '.join([ring(shape.exterior.coords)]+[ring(h.coords)for h in shape.interiors])
    if hasattr(shape,'geoms'):
        return ' '.join(path_data(p)for p in shape.geoms if p.geom_type in ('Polygon','MultiPolygon'))
    return ''


def flatten(data):
    root=ET.fromstring(data)
    # Resolve existing straight-sided K clips in their own coordinate space.
    clips={}
    for e in root.iter(tag('clipPath')):
        assert e.get('clipPathUnits','userSpaceOnUse')=='userSpaceOnUse'
        assert len(e)==1 and e[0].tag==tag('path')
        clips[e.get('id')]=geometry(e[0].get('d'),e[0].get('fill-rule')=='evenodd')
    for e in root.iter():
        if e.get('clip-path'):
            clip=re.fullmatch(r'url\(#([^\)]+)\)',e.get('clip-path'))
            assert clip and clip[1]in clips
            assert e.tag==tag('g') and not e.get('transform')
            for child in list(e):
                assert child.tag==tag('path')and not child.get('transform')and not child.get('stroke')
                shape=geometry(child.get('d'),child.get('fill-rule')=='evenodd').intersection(clips[clip[1]])
                d=path_data(shape)
                if d:child.set('d',d);child.set('fill-rule','evenodd')
                else:e.remove(child)
            del e.attrib['clip-path']
    for parent in root.iter():
        for child in list(parent):
            if child.tag==tag('clipPath'):parent.remove(child)
    for parent in root.iter():
        for child in list(parent):
            if child.tag==tag('defs')and len(child)==0:parent.remove(child)

    def visit(parent):
        for index,child in enumerate(list(parent)):
            visit(child)
            if child.tag!=tag('svg'):continue
            vb=[float(x)for x in child.get('viewBox').replace(',',' ').split()]
            x,y=float(child.get('x',0)),float(child.get('y',0))
            width,height=float(child.get('width',vb[2])),float(child.get('height',vb[3]))
            assert child.get('preserveAspectRatio','xMidYMid meet')=='xMidYMid meet'
            scale=min(width/vb[2],height/vb[3]);dx=x+(width-vb[2]*scale)/2;dy=y+(height-vb[3]*scale)/2
            attrs={k:v for k,v in child.attrib.items()if k not in {'width','height','x','y','viewBox','preserveAspectRatio','role','aria-label','transform'}}
            attrs['transform']=(child.get('transform','')+' '+f'translate({dx:.12g} {dy:.12g}) scale({scale:.12g}) translate({-vb[0]:.12g} {-vb[1]:.12g})').strip()
            group=ET.Element(tag('g'),attrs)
            group.extend(list(child));parent.remove(child);parent.insert(index,group)
    visit(root)
    assert len(list(root.iter(tag('svg'))))==1
    assert not list(root.iter(tag('clipPath')))
    return ET.tostring(root,encoding='utf-8',xml_declaration=True)


if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('directory',type=Path);args=parser.parse_args()
    count=0
    for p in args.directory.rglob('*.svg'):
        old=p.read_bytes()
        r=ET.fromstring(old)
        if len(list(r.iter(tag('svg'))))>1 or list(r.iter(tag('clipPath'))):
            p.write_bytes(flatten(old));count+=1
    print(f'Prepared {count} portable SVGs.')
