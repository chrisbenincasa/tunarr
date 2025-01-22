export function assistedInject(): ClassDecorator {
  return (target: any): void => {
    console.log(
      'hellooooo',
      target,
      Reflect.getOwnMetadataKeys(target),
      Reflect.getOwnMetadata('inversify:paramtypes', target),
    );
  };
}

export function assisted(): ParameterDecorator {
  return (target: any): void => {
    console.log('hellooooo', target, Reflect.getOwnMetadataKeys(target));
  };
}
